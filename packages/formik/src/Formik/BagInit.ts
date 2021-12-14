import * as React from 'react';
import {decorate, action, observable} from 'mobx';
import { FormikReducer } from './Reducer';

interface IProps<Values> {
  initialValues: any;
  initialTouched: any;
  initialErrors: any;
  initialStatus: any;
}

export class FormikBagInitials<Values> {
  reducer: FormikReducer<Values>;
  props: IProps<Values> = {} as any;

  constructor(reducer: FormikReducer<Values>) {
    this.reducer = reducer
  }
  
  setProps(props: IProps<Values>) {
    this.props = props
  }
}

decorate(FormikBagInitials, {
  reducer: observable,
  props: observable,
  setProps: action.bound,
})

