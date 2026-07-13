// app/src/features/Map/viewmodels/MapViewModel.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { Coordinate, toGeoJSONCoordinate } from '../models/Location';
import { LocationService } from '../services/LocationService';

// Define a type for the heading subscription
type HeadingSubscription = { remove: () => void };

// Below this GPS ground speed (m/s), the device is treated as stationary —
// filters out compass/GPS noise that would otherwise read as "heading somewhere".
const MIN_MOVING_SPEED_MPS = 1;

export class MapViewModel {
  userLocation: Coordinate = { longitude: -85.2749, latitude: 35.0458 };
  userHeading: number = 0;
  headingValid: boolean = false;
  userSpeed: number = 0;
  isInitialized: boolean = false;
  loading: boolean = false;
  showCrosswalkPolygon: boolean = false; // Toggle for polygon visibility
  private headingSubscription: HeadingSubscription | null = null;

  constructor() {
    makeAutoObservable(this);
    // isInitialized is set immediately — location permission and tracking
    // are owned by MapViewComponent to avoid double permission requests.
    runInAction(() => {
      this.isInitialized = true;
    });
  }

  // Start tracking device heading
  startHeadingTracking() {
    this.stopHeadingTracking(); // Clear any existing subscription
    
    this.headingSubscription = LocationService.watchHeadingUpdates((heading) => {
      runInAction(() => {
        this.userHeading = heading;
        this.headingValid = true;
      });
    });
  }
  
  // Stop tracking heading
  stopHeadingTracking() {
    if (this.headingSubscription) {
      this.headingSubscription.remove();
      this.headingSubscription = null;
    }
  }

  async getCurrentLocation() {
    this.setLoading(true);
    try {
      const location = await LocationService.getCurrentLocation();
      if (location) {
        runInAction(() => {
          this.userLocation = location;
          // Update heading if available in location
          if (location.heading !== undefined) {
            this.userHeading = location.heading;
          }
          this.isInitialized = true;
        });
        return location;
      } else {
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

  setUserLocation(location: Coordinate) {
    this.userLocation = location;
    if (location.heading !== undefined) {
      this.userHeading = location.heading;
      this.headingValid = true;
    }
    if (location.speed !== undefined && location.speed !== null) {
      this.userSpeed = location.speed;
    }
  }

  // Get user heading
  getUserHeading(): number {
    return this.userHeading;
  }

  get isMoving(): boolean {
    return this.userSpeed >= MIN_MOVING_SPEED_MPS;
  }

  setLoading(loading: boolean) {
    this.loading = loading;
  }

  // Set crosswalk polygon visibility
  setCrosswalkPolygonVisibility(visible: boolean): void {
    this.showCrosswalkPolygon = visible;
  }

  get userLocationCoordinate(): [number, number] {
    return toGeoJSONCoordinate(this.userLocation);
  }
  
  // Cleanup method to handle resources
  cleanup() {
    this.stopHeadingTracking();
  }
}

export default MapViewModel;