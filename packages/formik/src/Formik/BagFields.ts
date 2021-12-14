
import {decorate, action, observable } from 'mobx';
import {
  FieldMetaProps,
  FieldHelperProps,
  FieldInputProps,
} from '../types';
import {
  isString,
  getIn,
  isObject,
} from '../utils';
import { FormikReducer } from './Reducer';
import { FormikBag } from './Bag';
import { warnAboutMissingIdentifier } from './functions';

interface IProps<Values> {
  validateOnChange?: any;
  validateOnBlur?: any;
}

export class FormikBagFields<Values> {
  reducer: FormikReducer<Values>;
  bag: FormikBag<Values>;
  props: IProps<Values>;

  constructor(reducer: FormikReducer<Values>, bag: FormikBag<Values>, props: IProps<Values>) {
    this.reducer = reducer
    this.bag = bag
    this.props = props
  }

  setProps(props: IProps<Values>) {
    this.props = props
  }

  
  setFieldError = (
    (field: string, value: string | undefined) => {
      this.reducer.SET_FIELD_ERROR(field, value);
    }
  );

  setFieldValue = (
    (field: string, value: any, shouldValidate?: boolean) => {
      this.reducer.SET_FIELD_VALUE(
          field,
          value,
        );
      const willValidate =
        shouldValidate === undefined ? this.props.validateOnChange : shouldValidate;
      this.reducer.setIn('values', field, value)
      return willValidate
        ? this.bag.validate.validateFormWithHighPriority(this.reducer.values)
        : Promise.resolve();
    }
  );

  setFieldTouched = (
    (field: string, touched: boolean = true, shouldValidate?: boolean) => {
      this.reducer.SET_FIELD_TOUCHED(
          field,
          touched,
        );
      const willValidate =
        shouldValidate === undefined ? this.props.validateOnBlur : shouldValidate;
      return willValidate
        ? this.bag.validate.validateFormWithHighPriority(this.reducer.values)
        : Promise.resolve();
    }
  );

  // [setFieldTouched]
  executeBlur = (
    (e: any, path?: string) => {
      if (e.persist) {
        e.persist();
      }
      const { name, id, outerHTML } = e.target;
      const field = path ? path : name ? name : id;

      if (!field && __DEV__) {
        warnAboutMissingIdentifier({
          htmlContent: outerHTML,
          documentationAnchorLink: 'handleblur-e-any--void',
          handlerName: 'handleBlur',
        });
      }

      this.setFieldTouched(field, true);
    }
  );

  // <FormikHandlers['handleBlur']>
  handleBlur = 
    (eventOrString: any): void | ((e: any) => void) => {
      if (isString(eventOrString)) {
        return event => this.executeBlur(event, eventOrString);
      } else {
        this.executeBlur(eventOrString);
      }
    }

  // [state.errors, state.touched, state.values]
  getFieldMeta = (name: string): FieldMetaProps<any> => {
      return {
        value: getIn(this.reducer.values, name),
        error: getIn(this.reducer.errors, name),
        touched: !!getIn(this.reducer.touched, name),
        initialValue: getIn(this.bag.inits.props.initialValues, name),
        initialTouched: !!getIn(this.bag.inits.props.initialTouched, name),
        initialError: getIn(this.bag.inits.props.initialErrors, name),
      };
    }
  // [setFieldValue, setFieldTouched, setFieldError]
  getFieldHelpers = (name: string): FieldHelperProps<any> => {
      return {
        setValue: (value: any, shouldValidate?: boolean) =>
          this.setFieldValue(name, value, shouldValidate),
        setTouched: (value: boolean, shouldValidate?: boolean) =>
          this.setFieldTouched(name, value, shouldValidate),
        setError: (value: any) => this.setFieldError(name, value),
      };
    }

  // [handleBlur, handleChange, state.values]
  getFieldProps = (nameOrOptions): FieldInputProps<any> => {
      const isAnObject = isObject(nameOrOptions);
      const name = isAnObject ? nameOrOptions.name : nameOrOptions;
      const valueState = getIn(this.reducer.values, name);

      const field: FieldInputProps<any> = {
        name,
        value: valueState,
        onChange: this.bag.change.handleChange,
        onBlur: this.handleBlur,
      };
      if (isAnObject) {
        const {
          type,
          value: valueProp, // value is special for checkboxes
          as: is,
          multiple,
        } = nameOrOptions;

        if (type === 'checkbox') {
          if (valueProp === undefined) {
            field.checked = !!valueState;
          } else {
            field.checked = !!(
              Array.isArray(valueState) && ~valueState.indexOf(valueProp)
            );
            field.value = valueProp;
          }
        } else if (type === 'radio') {
          field.checked = valueState === valueProp;
          field.value = valueProp;
        } else if (is === 'select' && multiple) {
          field.value = field.value || [];
          field.multiple = true;
        }
      }
      return field;
    };
}

decorate(FormikBagFields, {
  reducer: observable,
  bag: observable,
  props: observable,
  setProps: action.bound,
  setFieldError: action.bound,
  setFieldValue: action.bound,
  setFieldTouched: action.bound,
  executeBlur: action.bound,
  handleBlur: action.bound,
  getFieldMeta: action.bound,
  getFieldHelpers: action.bound,
  getFieldProps: action.bound,
})