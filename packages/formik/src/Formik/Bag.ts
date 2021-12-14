import * as React from 'react';
import {decorate, action, observable, computed} from 'mobx';
import isEqual from 'react-fast-compare';
import {
  FormikConfig,
  FormikErrors,
  FormikState,
  FormikTouched,
} from '../types';
import {
  isFunction,
} from '../utils';
import { FormikReducer } from './Reducer';
import { FormikBagFields } from './BagFields';
import { FormikBagForm } from './BagForm';
import { FormikBagChange } from './BagChange';
import { FormikBagValidate } from './BagValidate';
import { FormikBagInitials } from './BagInit';

interface IProps<Values> extends FormikConfig<Values> {
  validateOnBlur: boolean;
  validateOnChange: boolean;
  isInitialValid: any;
}
export class FormikBag<Values> {
  reducer: FormikReducer<Values>;
  fields: FormikBagFields<Values>;
  form: FormikBagForm<Values>;
  change: FormikBagChange<Values>;
  validate: FormikBagValidate<Values>;
  inits: FormikBagInitials<Values>;
  props: IProps<Values> = {} as any;

  constructor(reducer: FormikReducer<Values>, props: IProps<Values>) {
    this.reducer = reducer;
    this.validate = new FormikBagValidate(reducer, props)
    this.fields = new FormikBagFields(reducer, this, props)
    this.form = new FormikBagForm(reducer, this, props)
    this.change = new FormikBagChange(reducer, this.fields)
    this.inits = new FormikBagInitials(reducer)
    this.setProps(props);
  }

  setProps(props: IProps<Values>) {
    this.props = props;
    this.inits.setProps(props);
    this.validate.setProps(props);
    this.fields.setProps(props);
    this.form.setProps(props);
  }

  setTouched = (
    (touched: FormikTouched<Values>, shouldValidate?: boolean) => {
      this.reducer.SET_TOUCHED( touched );
      const willValidate =
        shouldValidate === undefined ? this.props.validateOnBlur : shouldValidate;
      return willValidate
        ? this.validate.validateFormWithHighPriority(this.reducer.values)
        : Promise.resolve();
    }
  );

  setErrors = ((errors: FormikErrors<Values>) => {
    this.reducer.SET_ERRORS( errors );
  });

  setValues = (
    (values: React.SetStateAction<Values>, shouldValidate?: boolean) => {
      const resolvedValues = isFunction(values) ? values(this.reducer.values) : values;

      this.reducer.SET_VALUES( resolvedValues );
      const willValidate =
        shouldValidate === undefined ? this.props.validateOnChange : shouldValidate;
      return willValidate
        ? this.validate.validateFormWithHighPriority(resolvedValues)
        : Promise.resolve();
    }
  );

  setFormikState = (
    stateOrCb:
      | FormikState<Values>
      | ((state: FormikState<Values>) => FormikState<Values>)
  ): void => {
    if (isFunction(stateOrCb)) {
      this.reducer.SET_FORMIK_STATE( stateOrCb );
    } else {
      this.reducer.SET_FORMIK_STATE( () => stateOrCb );
    }
  };

  // [initialValues.current, state.values]
  get dirty() {
    return !isEqual(this.inits.props.initialValues, this.reducer.values);
  }

  // [isInitialValid, dirty, state.errors, props]
  get isValid() {
    return (typeof this.props.isInitialValid !== 'undefined'
    ? this.dirty
      ? this.reducer.errors && Object.keys(this.reducer.errors).length === 0
      : this.props.isInitialValid !== false && isFunction(this.props.isInitialValid)
      ? (this.props.isInitialValid as (props: FormikConfig<Values>) => boolean)(this.props)
      : (this.props.isInitialValid as boolean)
    : this.reducer.errors && Object.keys(this.reducer.errors).length === 0);
  }
}

decorate(FormikBag, {
  reducer: observable,
  fields: observable,
  form: observable,
  change: observable,
  props: observable,
  inits: observable,
  setTouched: action.bound,
  setErrors: action.bound,
  setValues: action.bound,
  setFormikState: action.bound,
  dirty: computed,
  isValid: computed,
})