import {decorate, action, observable} from 'mobx';
import {
  FormikErrors,
} from '../types';
import {
  isFunction,
  setIn,
  isPromise,
  getIn,
} from '../utils';
import { arrayMerge, deepmerge, validateYupSchema, yupToFormErrors } from './functions';
import { FormikReducer } from './Reducer';


const emptyErrors = {};
interface IProps<Values> {
  validate?(v: Values, field?: any): void;
  validationSchema: any;
}
export class FormikBagValidate<Values> {
  reducer: FormikReducer<Values>;
  fieldRegistry: any = {};
  props: IProps<Values>;

  constructor(reducer: FormikReducer<Values>, props: IProps<Values>) {
    this.reducer = reducer
    this.props = props
  }

  setProps(props: IProps<Values>) {
    this.props = props
  }
  
  // [props.validate]  
  runValidateHandler = (
    (values: Values, field?: string): Promise<FormikErrors<Values>> => {
      return new Promise((resolve, reject) => {
        const maybePromisedErrors = (this.props.validate as any)(values, field);
        if (maybePromisedErrors == null) {
          // use loose null check here on purpose
          resolve(emptyErrors);
        } else if (isPromise(maybePromisedErrors)) {
          (maybePromisedErrors as Promise<any>).then(
            errors => {
              resolve(errors || emptyErrors);
            },
            actualException => {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `Warning: An unhandled error was caught during validation in <Formik validate />`,
                  actualException
                );
              }

              reject(actualException);
            }
          );
        } else {
          resolve(maybePromisedErrors);
        }
      });
    }
  );

  // [props.validationSchema]
  /**
   * Run validation against a Yup schema and optionally run a function if successful
   */
  runValidationSchema = (
    (values: Values, field?: string): Promise<FormikErrors<Values>> => {
      const validationSchema = this.props.validationSchema;
      const schema = isFunction(validationSchema)
        ? validationSchema(field)
        : validationSchema;
      const promise =
        field && schema.validateAt
          ? schema.validateAt(field, values)
          : validateYupSchema(values, schema);
      return new Promise((resolve, reject) => {
        promise.then(
          () => {
            resolve(emptyErrors);
          },
          (err: any) => {
            // Yup will throw a validation error if validation fails. We catch those and
            // resolve them into Formik errors. We can sniff if something is a Yup error
            // by checking error.name.
            // @see https://github.com/jquense/yup#validationerrorerrors-string--arraystring-value-any-path-string
            if (err.name === 'ValidationError') {
              resolve(yupToFormErrors(err));
            } else {
              // We throw any other errors
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `Warning: An unhandled error was caught during validation in <Formik validationSchema />`,
                  err
                );
              }

              reject(err);
            }
          }
        );
      });
    }
  );

  runSingleFieldLevelValidation = (
    (field: string, value: void | string): Promise<string> => {
      return new Promise(resolve =>
        resolve(this.fieldRegistry[field].validate(value) as string)
      );
    }
  );

  // [runSingleFieldLevelValidation]
  runFieldLevelValidations = (
    (values: Values): Promise<FormikErrors<Values>> => {
      const fieldKeysWithValidation: string[] = Object.keys(
        this.fieldRegistry
      ).filter(f => isFunction(this.fieldRegistry[f].validate));

      // Construct an array with all of the field validation functions
      const fieldValidations: Promise<string>[] =
        fieldKeysWithValidation.length > 0
          ? fieldKeysWithValidation.map(f =>
              this.runSingleFieldLevelValidation(f, getIn(values, f))
            )
          : [Promise.resolve('DO_NOT_DELETE_YOU_WILL_BE_FIRED')]; // use special case ;)

      return Promise.all(fieldValidations).then((fieldErrorsList: string[]) =>
        fieldErrorsList.reduce((prev, curr, index) => {
          if (curr === 'DO_NOT_DELETE_YOU_WILL_BE_FIRED') {
            return prev;
          }
          if (curr) {
            prev = setIn(prev, fieldKeysWithValidation[index], curr);
          }
          return prev;
        }, {})
      );
    }
  );

  // [
  //   props.validate,
  //   props.validationSchema,
  //   runFieldLevelValidations,
  //   runValidateHandler,
  //   runValidationSchema,
  // ]
  // Run all validations and return the result
  runAllValidations = (
    (values: Values) => {
      return Promise.all([
        this.runFieldLevelValidations(values),
        this.props.validationSchema ? this.runValidationSchema(values) : {},
        this.props.validate ? this.runValidateHandler(values) : {},
      ]).then(([fieldErrors, schemaErrors, validateErrors]) => {
        const combinedErrors = deepmerge.all<FormikErrors<Values>>(
          [fieldErrors, schemaErrors, validateErrors],
          { arrayMerge }
        );
        return combinedErrors;
      });
    }
    
  );

  // Run all validations methods and update state accordingly
  validateFormWithHighPriority = (
    (values: Values = this.reducer.values) => {
      this.reducer.SET_ISVALIDATING( true );
      return this.runAllValidations(values).then(combinedErrors => {
        if (!!isMounted.current) {
          this.reducer.SET_ISVALIDATING( false );
          this.reducer.SET_ERRORS( combinedErrors );
        }
        return combinedErrors;
      });
    }
  );
  
  validateField = ((name: string) => {
    // This will efficiently validate a single field by avoiding state
    // changes if the validation function is synchronous. It's different from
    // what is called when using validateForm.

    if (
      this.fieldRegistry[name] &&
      isFunction(this.fieldRegistry[name].validate)
    ) {
      const value = getIn(this.reducer.values, name);
      const maybePromise = this.fieldRegistry[name].validate(value);
      if (isPromise(maybePromise)) {
        // Only flip isValidating if the function is async.
        this.reducer.SET_ISVALIDATING( true );
        return maybePromise
          .then((x: any) => x)
          .then((error: string) => {
            this.reducer.SET_FIELD_ERROR(name, error );
            this.reducer.SET_ISVALIDATING( false );
          });
      } else {
        this.reducer.SET_FIELD_ERROR(name, maybePromise as string | undefined);
        return Promise.resolve(maybePromise as string | undefined);
      }
    } else if (this.props.validationSchema) {
      this.reducer.SET_ISVALIDATING( true );
      return this.runValidationSchema(this.reducer.values, name)
        .then((x: any) => x)
        .then((error: any) => {
          this.reducer.SET_FIELD_ERROR( name, error[name] );
          this.reducer.SET_ISVALIDATING( false );
        });
    }

    return Promise.resolve();
  });

  registerField = ((name: string, { validate }: any) => {
    this.fieldRegistry[name] = {
      validate,
    };
  });

  unregisterField = ((name: string) => {
    delete this.fieldRegistry[name];
  });
}

decorate(FormikBagValidate, {
  reducer: observable,
  fieldRegistry: observable,
  props: observable,
  setProps: action.bound,
  runValidateHandler: action.bound,
  runValidationSchema: action.bound,
  runSingleFieldLevelValidation: action.bound,
  runFieldLevelValidations: action.bound,
  runAllValidations: action.bound,
  validateFormWithHighPriority: action.bound,
  validateField: action.bound,
  registerField: action.bound,
  unregisterField: action.bound,
})