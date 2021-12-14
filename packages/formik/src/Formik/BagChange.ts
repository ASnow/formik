import * as React from 'react';
import {decorate, action, observable} from 'mobx';
import {
  isString,
  getIn,
} from '../utils';
import { FormikReducer } from './Reducer';
import { FormikBagFields } from './BagFields';
import { warnAboutMissingIdentifier } from './functions';


export class FormikBagChange<Values> {
  reducer: FormikReducer<Values>;
  fields: FormikBagFields<Values>;

  constructor(reducer: FormikReducer<Values>, fields: FormikBagFields<Values>) {
    this.reducer = reducer
    this.fields = fields
  }
  
 
  // [setFieldValue, state.values]
  executeChange = (
    (eventOrTextValue: string | React.ChangeEvent<any>, maybePath?: string) => {
      // By default, assume that the first argument is a string. This allows us to use
      // handleChange with React Native and React Native Web's onChangeText prop which
      // provides just the value of the input.
      let field = maybePath;
      let val = eventOrTextValue;
      let parsed;
      // If the first argument is not a string though, it has to be a synthetic React Event (or a fake one),
      // so we handle like we would a normal HTML change event.
      if (!isString(eventOrTextValue)) {
        // If we can, persist the event
        // @see https://reactjs.org/docs/events.html#event-pooling
        if ((eventOrTextValue as any).persist) {
          (eventOrTextValue as React.ChangeEvent<any>).persist();
        }
        const target = eventOrTextValue.target
          ? (eventOrTextValue as React.ChangeEvent<any>).target
          : (eventOrTextValue as React.ChangeEvent<any>).currentTarget;

        const {
          type,
          name,
          id,
          value,
          checked,
          outerHTML,
          options,
          multiple,
        } = target;

        field = maybePath ? maybePath : name ? name : id;
        if (!field && __DEV__) {
          warnAboutMissingIdentifier({
            htmlContent: outerHTML,
            documentationAnchorLink: 'handlechange-e-reactchangeeventany--void',
            handlerName: 'handleChange',
          });
        }
        val = /number|range/.test(type)
          ? ((parsed = parseFloat(value)), isNaN(parsed) ? '' : parsed)
          : /checkbox/.test(type) // checkboxes
          ? getValueForCheckbox(getIn(this.reducer.values, field!), checked, value)
          : options && multiple // <select multiple>
          ? getSelectedValues(options)
          : value;
      }

      if (field) {
        // Set form fields by name
        this.fields.setFieldValue(field, val);
      }
    }
  );

  // <FormikHandlers['handleChange']>
  handleChange = (
    (
      eventOrPath: string | React.ChangeEvent<any>
    ): void | ((eventOrTextValue: string | React.ChangeEvent<any>) => void) => {
      if (isString(eventOrPath)) {
        return event => this.executeChange(event, eventOrPath);
      } else {
        this.executeChange(eventOrPath);
      }
    }
  );
}

decorate(FormikBagChange, {
  reducer: observable,
  fields: observable,
  executeChange: action.bound,
  handleChange: action.bound,
})


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