// src/features/Map/viewmodels/LocationViewModel.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { Coordinate } from '../models/Location';
import { LocationService } from '../services/LocationService';
import { BaseViewModel } from '../../../core/viewmodels/BaseViewModel';

export class LocationViewModel extends BaseViewModel {
  userLocation: Coordinate = { longitude: -85.2749, latitude: 35.0458 };
  isInitialized: boolean = false;
  
  constructor() {
    super();
    makeAutoObservable(this);
    this.init();
  }
  
  async init() {
    try {
      const hasPermission = await LocationService.requestPermission();
      if (hasPermission) {
        await this.getCurrentLocation();
      } else {
        runInAction(() => {
          this.isInitialized = true;
        });
      }
    } catch (error) {
      runInAction(() => {
        this.isInitialized = true;
      });
    }
  }
  
  async getCurrentLocation() {
    this.setLoading(true);
    try {
      const location = await LocationService.getCurrentLocation();
      if (location) {
        runInAction(() => {
          this.userLocation = location;
          this.isInitialized = true;
        });
        return location;
      } else {
        // Silently fall back to default location instead of showing an error
        // This commonly happens on emulators without location configured
        console.log('Location unavailable, using default location');
        runInAction(() => {
          this.isInitialized = true;
        });
        return null;
      }
    } catch (error) {
      runInAction(() => {
        this.isInitialized = true;
      });
      return null;
    } finally {
      this.setLoading(false);
    }
  }
  
  get userLocationCoordinate(): [number, number] {
    return [this.userLocation.longitude, this.userLocation.latitude];
  }
}

export default LocationViewModel;