import {decorate, action, observable, set, has} from 'mobx';
import isEqual from 'react-fast-compare';
import {
  FormikErrors,
  FormikTouched,
} from '../types';
import {
  setNestedObjectValues,
} from '../utils';

interface IState<Values> {
  values: Values;
  touched: FormikTouched<Values>;
  errors: FormikErrors<Values>;
  isSubmitting: boolean;
  isValidating: boolean;
  status: any;
  submitCount: number;
}

function keyDefaultValue(pathKey: string) {
  if (pathKey[0].match(/[0-9]/)) {
    return observable.array();
  } else {
    return observable.object();
  }
}

export class FormikReducer<Values> implements IState<Values> {
  values: Values;
  touched: FormikTouched<Values>;
  errors: FormikErrors<Values>;
  isSubmitting: boolean;
  isValidating: boolean;
  submitCount: number;
  status: any;

  constructor({
    values,
    errors,
    touched,
    status,
    isSubmitting,
    isValidating,
    submitCount,
  }: IState<Values>) {
    this.values = values;
    this.errors = errors;
    this.touched = touched;
    this.status = status;
    this.isSubmitting = isSubmitting;
    this.isValidating = isValidating;
    this.submitCount = submitCount;

  }

  setIn(collectionName: 'values' | 'errors' | 'touched', field: string, value: any) {
    const path = field.split(/(\.|\[|]\[]\.|])/g).filter(Boolean)
    const last = path.pop();
    let ctx = this[collectionName] as any;
    for (const pathKey of path) {
      if (!has(ctx, pathKey)) {
        set(ctx, pathKey, keyDefaultValue(pathKey))
      }
      ctx = ctx[pathKey];
    }

    set(ctx, last, value);
  }
  SET_VALUES(values: Values) {
    this.values = values;
  }
  SET_TOUCHED(touched: {}) {
    this.touched = touched;
  }
  SET_ERRORS(errors: {}) {
    if (isEqual(this.errors, errors)) {
      return;
    }

    this.errors = errors
  }
  SET_STATUS(status: any) {
    this.status = status;
  }
  SET_ISSUBMITTING(isSubmitting: boolean) {
    this.isSubmitting = isSubmitting;
  }
  SET_ISVALIDATING(isValidating: boolean) {
    this.isValidating = isValidating;
  }
  SET_FIELD_VALUE(field: string, value: any) {
    this.setIn('values', field, value);
  }
  SET_FIELD_TOUCHED(field: string, value: any) {
    this.setIn('touched', field, value);
  }
  SET_FIELD_ERROR(field: string, value: any) {
    this.setIn('errors', field, value);
  }
  RESET_FORM({values,
    touched,
    errors,
    isSubmitting,
    isValidating}: IState<Values>) {
    this.values = values;
    this.touched = touched;
    this.errors = errors;
    this.isSubmitting = isSubmitting;
    this.isValidating = isValidating;
  }
  SET_FORMIK_STATE(cb: (state: IState<Values>) => void) {
    cb(this);
  }
  SUBMIT_ATTEMPT() {
      this.touched = setNestedObjectValues<FormikTouched<Values>>(
        this.values,
        true
      );
      this.isSubmitting = true;
      this.submitCount += 1;
  }
  SUBMIT_FAILURE() {
      this.isSubmitting = false
  }
  SUBMIT_SUCCESS() {
    this.isSubmitting = false
  }
}

decorate(FormikReducer, {
  values: observable,
  touched: observable,
  errors: observable,
  isSubmitting: observable,
  isValidating: observable,
  submitCount: observable,
  SET_VALUES: action.bound,
  SET_TOUCHED: action.bound,
  SET_ERRORS: action.bound,
  SET_STATUS: action.bound,
  SET_ISSUBMITTING: action.bound,
  SET_ISVALIDATING: action.bound,
  SET_FIELD_VALUE: action.bound,
  SET_FIELD_TOUCHED: action.bound,
  SET_FIELD_ERROR: action.bound,
  RESET_FORM: action.bound,
  SET_FORMIK_STATE: action.bound,
  SUBMIT_ATTEMPT: action.bound,
  SUBMIT_FAILURE: action.bound,
  SUBMIT_SUCCESS: action.bound,
})