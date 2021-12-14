import * as React from 'react';
import isEqual from 'react-fast-compare';
import deepmerge from 'deepmerge';
import isPlainObject from 'lodash/isPlainObject';
import invariant from 'tiny-warning';
import { useAsObservableSource, useLocalStore } from 'mobx-react';
import {
  FormikConfig,
  FormikErrors,
  FormikTouched,
  FormikValues,
  FormikProps,
} from './types';
import {
  isFunction,
  setIn,
  isEmptyChildren,
  getIn,
} from './utils';
import { FormikProvider } from './FormikContext';
import { FormikReducer } from './Formik/Reducer';
import { FormikBag } from './Formik/Bag';

// State reducer


// Initial empty states // objects
const emptyErrors: FormikErrors<unknown> = {};
const emptyTouched: FormikTouched<unknown> = {};

// This is an object that contains a map of all registered fields
// and their validate functions
interface FieldRegistry {
  [field: string]: {
    validate: (value: any) => string | Promise<string> | undefined;
  };
}

export function useFormik<Values extends FormikValues = FormikValues>({
  validateOnChange = true,
  validateOnBlur = true,
  validateOnMount = false,
  isInitialValid,
  enableReinitialize = false,
  onSubmit,
  ...rest
}: FormikConfig<Values>) {
  const props = {
    validateOnChange,
    validateOnBlur,
    validateOnMount,
    onSubmit,
    ...rest,
  };
  const initialValues = React.useRef(props.initialValues);
  const initialErrors = React.useRef(props.initialErrors || emptyErrors);
  const initialTouched = React.useRef(props.initialTouched || emptyTouched);
  const initialStatus = React.useRef(props.initialStatus);
  const isMounted = React.useRef<boolean>(false);
  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      invariant(
        typeof isInitialValid === 'undefined',
        'isInitialValid has been deprecated and will be removed in future versions of Formik. Please use initialErrors or validateOnMount instead.'
      );
      // eslint-disable-next-line
    }, []);
  }

  const state = useLocalStore(() => new FormikReducer({
    values: props.initialValues,
    errors: props.initialErrors || emptyErrors,
    touched: props.initialTouched || emptyTouched,
    status: props.initialStatus,
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
  }));

  const bag = useLocalStore(() => new FormikBag(state, props));

  React.useEffect(() => {
    bag.setProps(props);
  }, [props]);

  React.useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (
      validateOnMount &&
      isMounted.current === true &&
      isEqual(initialValues.current, props.initialValues)
    ) {
      bag.validate.validateFormWithHighPriority(initialValues.current);
    }
  }, [validateOnMount, bag.validate.validateFormWithHighPriority]);

  

  React.useEffect(() => {
    if (
      isMounted.current === true &&
      !isEqual(initialValues.current, props.initialValues)
    ) {
      if (enableReinitialize) {
        initialValues.current = props.initialValues;
        bag.form.resetForm();
      }

      if (validateOnMount) {
        bag.validate.validateFormWithHighPriority(initialValues.current);
      }
    }
  }, [
    enableReinitialize,
    props.initialValues,
    bag.form.resetForm,
    validateOnMount,
    bag.validate.validateFormWithHighPriority,
  ]);

  React.useEffect(() => {
    if (
      enableReinitialize &&
      isMounted.current === true &&
      !isEqual(initialErrors.current, props.initialErrors)
    ) {
      initialErrors.current = props.initialErrors || emptyErrors;
      state.SET_ERRORS(props.initialErrors || emptyErrors);
    }
  }, [enableReinitialize, props.initialErrors]);

  React.useEffect(() => {
    if (
      enableReinitialize &&
      isMounted.current === true &&
      !isEqual(initialTouched.current, props.initialTouched)
    ) {
      initialTouched.current = props.initialTouched || emptyTouched;
      state.SET_TOUCHED(props.initialTouched || emptyTouched);
    }
  }, [enableReinitialize, props.initialTouched]);

  React.useEffect(() => {
    if (
      enableReinitialize &&
      isMounted.current === true &&
      !isEqual(initialStatus.current, props.initialStatus)
    ) {
      initialStatus.current = props.initialStatus;
      state.SET_STATUS(props.initialStatus);
    }
  }, [enableReinitialize, props.initialStatus, props.initialTouched]);



  const ctx = {
    ...state,
    initialValues: initialValues.current,
    initialErrors: initialErrors.current,
    initialTouched: initialTouched.current,
    initialStatus: initialStatus.current,
    handleBlur: bag.fields.handleBlur,
    handleChange: bag.change.handleChange,
    handleReset: bag.form.handleReset,
    handleSubmit: bag.form.handleSubmit,
    resetForm: bag.form.resetForm,
    setErrors: bag.setErrors,
    setFormikState: bag.setFormikState,
    setFieldTouched: bag.fields.setFieldTouched,
    setFieldValue: bag.fields.setFieldValue,
    setFieldError: bag.fields.setFieldError,
    setStatus: state.SET_STATUS,
    setSubmitting: state.SET_ISSUBMITTING,
    setTouched: bag.setTouched,
    setValues: bag.setValues,
    submitForm: bag.form.submitForm,
    validateForm: bag.validate.validateFormWithHighPriority,
    validateField: bag.validate.validateField,
    isValid: bag.isValid,
    dirty: bag.dirty,
    unregisterField: bag.validate.unregisterField,
    registerField: bag.validate.registerField,
    getFieldProps: bag.fields.getFieldProps,
    getFieldMeta: bag.fields.getFieldMeta,
    getFieldHelpers: bag.fields.getFieldHelpers,
    validateOnBlur,
    validateOnChange,
    validateOnMount,
  };

  return ctx;
}

export function Formik<
  Values extends FormikValues = FormikValues,
  ExtraProps = {}
>(props: FormikConfig<Values> & ExtraProps) {
  const formikbag = useFormik<Values>(props);
  const { component, children, render, innerRef } = props;

  // This allows folks to pass a ref to <Formik />
  React.useImperativeHandle(innerRef, () => formikbag);

  if (__DEV__) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      invariant(
        !props.render,
        `<Formik render> has been deprecated and will be removed in future versions of Formik. Please use a child callback function instead. To get rid of this warning, replace <Formik render={(props) => ...} /> with <Formik>{(props) => ...}</Formik>`
      );
      // eslint-disable-next-line
    }, []);
  }
  return (
    <FormikProvider value={formikbag}>
      {component
        ? React.createElement(component as any, formikbag)
        : render
        ? render(formikbag)
        : children // children come last, always called
        ? isFunction(children)
          ? (children as (bag: FormikProps<Values>) => React.ReactNode)(
              formikbag as FormikProps<Values>
            )
          : !isEmptyChildren(children)
          ? React.Children.only(children)
          : null
        : null}
    </FormikProvider>
  );
}

function warnAboutMissingIdentifier({
  htmlContent,
  documentationAnchorLink,
  handlerName,
}: {
  htmlContent: string;
  documentationAnchorLink: string;
  handlerName: string;
}) {
  console.warn(
    `Warning: Formik called \`${handlerName}\`, but you forgot to pass an \`id\` or \`name\` attribute to your input:
    ${htmlContent}
    Formik cannot determine which value to update. For more info see https://formik.org/docs/api/formik#${documentationAnchorLink}
  `
  );
}

/**
 * Transform Yup ValidationError to a more usable object
 */
export function yupToFormErrors<Values>(yupError: any): FormikErrors<Values> {
  let errors: FormikErrors<Values> = {};
  if (yupError.inner) {
    if (yupError.inner.length === 0) {
      return setIn(errors, yupError.path, yupError.message);
    }
    for (let err of yupError.inner) {
      if (!getIn(errors, err.path)) {
        errors = setIn(errors, err.path, err.message);
      }
    }
  }
  return errors;
}

/**
 * Validate a yup schema.
 */
export function validateYupSchema<T extends FormikValues>(
  values: T,
  schema: any,
  sync: boolean = false,
  context: any = {}
): Promise<Partial<T>> {
  const validateData: FormikValues = prepareDataForValidation(values);
  return schema[sync ? 'validateSync' : 'validate'](validateData, {
    abortEarly: false,
    context: context,
  });
}

/**
 * Recursively prepare values.
 */
export function prepareDataForValidation<T extends FormikValues>(
  values: T
): FormikValues {
  let data: FormikValues = Array.isArray(values) ? [] : {};
  for (let k in values) {
    if (Object.prototype.hasOwnProperty.call(values, k)) {
      const key = String(k);
      if (Array.isArray(values[key]) === true) {
        data[key] = values[key].map((value: any) => {
          if (Array.isArray(value) === true || isPlainObject(value)) {
            return prepareDataForValidation(value);
          } else {
            return value !== '' ? value : undefined;
          }
        });
      } else if (isPlainObject(values[key])) {
        data[key] = prepareDataForValidation(values[key]);
      } else {
        data[key] = values[key] !== '' ? values[key] : undefined;
      }
    }
  }
  return data;
}

/**
 * deepmerge array merging algorithm
 * https://github.com/KyleAMathews/deepmerge#combine-array
 */
function arrayMerge(target: any[], source: any[], options: any): any[] {
  const destination = target.slice();

  source.forEach(function merge(e: any, i: number) {
    if (typeof destination[i] === 'undefined') {
      const cloneRequested = options.clone !== false;
      const shouldClone = cloneRequested && options.isMergeableObject(e);
      destination[i] = shouldClone
        ? deepmerge(Array.isArray(e) ? [] : {}, e, options)
        : e;
    } else if (options.isMergeableObject(e)) {
      destination[i] = deepmerge(target[i], e, options);
    } else if (target.indexOf(e) === -1) {
      destination.push(e);
    }
  });
  return destination;
}

/** Return multi select values based on an array of options */
function getSelectedValues(options: any[]) {
  return Array.from(options)
    .filter(el => el.selected)
    .map(el => el.value);
}

/** Return the next value for a checkbox */
function getValueForCheckbox(
  currentValue: string | any[],
  checked: boolean,
  valueProp: any
) {
  // If the current value was a boolean, return a boolean
  if (typeof currentValue === 'boolean') {
    return Boolean(checked);
  }

  // If the currentValue was not a boolean we want to return an array
  let currentArrayOfValues = [];
  let isValueInArray = false;
  let index = -1;

  if (!Array.isArray(currentValue)) {
    // eslint-disable-next-line eqeqeq
    if (!valueProp || valueProp == 'true' || valueProp == 'false') {
      return Boolean(checked);
    }
  } else {
    // If the current value is already an array, use it
    currentArrayOfValues = currentValue;
    index = currentValue.indexOf(valueProp);
    isValueInArray = index >= 0;
  }

  // If the checkbox was checked and the value is not already present in the aray we want to add the new value to the array of values
  if (checked && valueProp && !isValueInArray) {
    return currentArrayOfValues.concat(valueProp);
  }

  // If the checkbox was unchecked and the value is not in the array, simply return the already existing array of values
  if (!isValueInArray) {
    return currentArrayOfValues;
  }

  // If the checkbox was unchecked and the value is in the array, remove the value and return the array
  return currentArrayOfValues
    .slice(0, index)
    .concat(currentArrayOfValues.slice(index + 1));
}

// React currently throws a warning when using useLayoutEffect on the server.
// To get around it, we can conditionally useEffect on the server (no-op) and
// useLayoutEffect in the browser.
// @see https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'
    ? React.useLayoutEffect
    : React.useEffect;

function useEventCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref: any = React.useRef(fn);

  // we copy a ref to the callback scoped to the current state/props on each render
  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  });

  return React.useCallback(
    (...args: any[]) => ref.current.apply(void 0, args),
    []
  ) as T;
}
