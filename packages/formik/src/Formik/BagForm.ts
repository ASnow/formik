import * as React from 'react';
import {decorate, action, observable, computed} from 'mobx';
import {
  FormikErrors,
  FormikState,
} from '../types';
import {
  isFunction,
  isPromise,
  getActiveElement,
} from '../utils';
import { FormikReducer } from './Reducer';
import { FormikBagValidate } from './BagValidate';
import { invariant } from './functions';
import { FormikBag } from './Bag';
import { FormikHelpers } from '..';

interface IProps<Values> {
  onSubmit(vals: Values, hlps: FormikHelpers<Values>): any;
  onReset?(vals: Values, hlps: FormikHelpers<Values>): any;
}

export class FormikBagForm<Values> {
  reducer: FormikReducer<Values>;
  validate: FormikBagValidate<Values>;
  bag: FormikBag<Values>;
  props: IProps<Values>;

  constructor(reducer: FormikReducer<Values>, bag: FormikBag<Values>, props: IProps<Values>) {
    this.reducer = reducer
    this.validate = bag.validate
    this.bag = bag
    this.props = props
  }

  setProps(props: IProps<Values>) {
    this.props = props
  }
  
  // [props.initialErrors, props.initialStatus, props.initialTouched]

  resetForm = (
    (nextState?: Partial<FormikState<Values>>) => {
      const values =
        nextState && nextState.values
          ? nextState.values
          : this.bag.inits.props.initialValues;
      const errors =
        nextState && nextState.errors
          ? nextState.errors
          : this.bag.inits.props.initialErrors || {};
      const touched =
        nextState && nextState.touched
          ? nextState.touched
          : this.bag.inits.props.initialTouched || {};
      const status =
        nextState && nextState.status
          ? nextState.status
          : this.bag.inits.props.initialStatus;
      this.bag.inits.setProps({
        initialValues: values,
        initialErrors: errors,
        initialTouched: touched,
        initialStatus: status,
      })
      
      
      
      

      const dispatchFn = () => {
        this.reducer.RESET_FORM({
            isSubmitting: !!nextState && !!nextState.isSubmitting,
            errors,
            touched,
            status,
            values,
            isValidating: !!nextState && !!nextState.isValidating,
            submitCount:
              !!nextState &&
              !!nextState.submitCount &&
              typeof nextState.submitCount === 'number'
                ? nextState.submitCount
                : 0,
          });
      };

      if (this.props.onReset) {
        const maybePromisedOnReset = (this.props.onReset as any)(
          this.reducer.values,
          this.imperativeMethods
        );

        if (isPromise(maybePromisedOnReset)) {
          (maybePromisedOnReset as Promise<any>).then(dispatchFn);
        } else {
          dispatchFn();
        }
      } else {
        dispatchFn();
      }
    }
  );

  submitForm = (() => {
    this.reducer.SUBMIT_ATTEMPT();
    return this.validate.validateFormWithHighPriority().then(
      (combinedErrors: FormikErrors<Values>) => {
        // In case an error was thrown and passed to the resolved Promise,
        // `combinedErrors` can be an instance of an Error. We need to check
        // that and abort the submit.
        // If we don't do that, calling `Object.keys(new Error())` yields an
        // empty array, which causes the validation to pass and the form
        // to be submitted.

        const isInstanceOfError = combinedErrors instanceof Error;
        const isActuallyValid =
          !isInstanceOfError && Object.keys(combinedErrors).length === 0;
        if (isActuallyValid) {
          // Proceed with submit...
          //
          // To respect sync submit fns, we can't simply wrap executeSubmit in a promise and
          // _always_ dispatch SUBMIT_SUCCESS because isSubmitting would then always be false.
          // This would be fine in simple cases, but make it impossible to disable submit
          // buttons where people use callbacks or promises as side effects (which is basically
          // all of v1 Formik code). Instead, recall that we are inside of a promise chain already,
          //  so we can try/catch executeSubmit(), if it returns undefined, then just bail.
          // If there are errors, throw em. Otherwise, wrap executeSubmit in a promise and handle
          // cleanup of isSubmitting on behalf of the consumer.
          let promiseOrUndefined;
          try {
            promiseOrUndefined = this.executeSubmit();
            // Bail if it's sync, consumer is responsible for cleaning up
            // via setSubmitting(false)
            if (promiseOrUndefined === undefined) {
              return;
            }
          } catch (error) {
            throw error;
          }

          return Promise.resolve(promiseOrUndefined)
            .then(result => {
              if (!!isMounted.current) {
                this.reducer.SUBMIT_SUCCESS();
              }
              return result;
            })
            .catch(_errors => {
              if (!!isMounted.current) {
                this.reducer.SUBMIT_FAILURE();
                // This is a legit error rejected by the onSubmit fn
                // so we don't want to break the promise chain
                throw _errors;
              }
            });
        } else if (!!isMounted.current) {
          // ^^^ Make sure Formik is still mounted before updating state
          this.reducer.SUBMIT_FAILURE();
          // throw combinedErrors;
          if (isInstanceOfError) {
            throw combinedErrors;
          }
        }
        return;
      }
    );
  });

  handleSubmit = (
    (e?: React.FormEvent<HTMLFormElement>) => {
      if (e && e.preventDefault && isFunction(e.preventDefault)) {
        e.preventDefault();
      }

      if (e && e.stopPropagation && isFunction(e.stopPropagation)) {
        e.stopPropagation();
      }

      // Warn if form submission is triggered by a <button> without a
      // specified `type` attribute during development. This mitigates
      // a common gotcha in forms with both reset and submit buttons,
      // where the dev forgets to add type="button" to the reset button.
      if (__DEV__ && typeof document !== 'undefined') {
        // Safely get the active element (works with IE)
        const activeElement = getActiveElement();
        if (
          activeElement !== null &&
          activeElement instanceof HTMLButtonElement
        ) {
          invariant(
            activeElement.attributes &&
              activeElement.attributes.getNamedItem('type'),
            'You submitted a Formik form using a button with an unspecified `type` attribute.  Most browsers default button elements to `type="submit"`. If this is not a submit button, please add `type="button"`.'
          );
        }
      }

      this.submitForm().catch(reason => {
        console.warn(
          `Warning: An unhandled error was caught from submitForm()`,
          reason
        );
      });
    }
  );
  executeSubmit = (() => {
    return this.props.onSubmit(this.reducer.values, this.imperativeMethods);
  });

  handleReset = (e => {
    if (e && e.preventDefault && isFunction(e.preventDefault)) {
      e.preventDefault();
    }

    if (e && e.stopPropagation && isFunction(e.stopPropagation)) {
      e.stopPropagation();
    }

    this.resetForm();
  });


  get imperativeMethods(): FormikHelpers<Values> {
    return {
      resetForm: this.resetForm,
      validateForm: this.validate.validateFormWithHighPriority,
      validateField: this.validate.validateField,
      setErrors: this.bag.setErrors,
      setFieldError: this.bag.fields.setFieldError,
      setFieldTouched: this.bag.fields.setFieldTouched,
      setFieldValue: this.bag.fields.setFieldValue,
      setStatus: this.reducer.SET_STATUS,
      setSubmitting: this.reducer.SET_ISSUBMITTING,
      setTouched: this.bag.setTouched,
      setValues: this.bag.setValues,
      setFormikState: this.bag.setFormikState,
      submitForm: this.submitForm,
    };
  }
}

decorate(FormikBagForm, {
  reducer: observable,
  bag: observable,
  validate: observable,
  props: observable,
  setProps: action.bound,
  resetForm: action.bound,
  submitForm: action.bound,
  handleSubmit: action.bound,
  executeSubmit: action.bound,
  handleReset: action.bound,
  imperativeMethods: computed,
})