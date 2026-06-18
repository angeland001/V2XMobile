// src/core/viewmodels/BaseViewModel.ts
import { makeAutoObservable } from 'mobx';

export class BaseViewModel {
  loading: boolean = false;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  setLoading(loading: boolean) {
    this.loading = loading;
  }
}

export default BaseViewModel;