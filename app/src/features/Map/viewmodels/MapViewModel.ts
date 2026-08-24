// app/src/features/Map/viewmodels/MapViewModel.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { distance, point } from '@turf/turf';
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
  // Last raw position sample, used to derive a speed from position deltas —
  // see setUserLocation. Not observable; purely an internal calculation input.
  private lastLocationSample: { lat: number; lng: number; atMs: number } | null = null;

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

    // GPS mock/spoofer tools (used for testing without a real drive) commonly
    // leave coords.speed at 0/undefined even while genuinely moving the
    // reported position — relying on reported speed alone left isMoving
    // permanently false under those tools, silently disabling anything gated
    // on it (ambient TIM proximity checks). Derive a speed from consecutive
    // position samples and take whichever of reported/derived is higher, so a
    // real device's more-accurate reported speed still wins when both exist,
    // but a spoofer's fake position movement still counts as "moving".
    const now = Date.now();
    let derivedSpeed = 0;
    if (this.lastLocationSample) {
      const dtS = (now - this.lastLocationSample.atMs) / 1000;
      if (dtS > 0.1 && dtS < 10) {
        const meters = distance(
          point([this.lastLocationSample.lng, this.lastLocationSample.lat]),
          point([location.longitude, location.latitude]),
          { units: 'meters' },
        );
        // Ignore sub-2m deltas — GPS jitter at a dead stop, not real movement.
        if (meters > 2) {
          derivedSpeed = meters / dtS;
        }
      }
    }
    this.lastLocationSample = { lat: location.latitude, lng: location.longitude, atMs: now };

    const reportedSpeed = location.speed ?? 0;
    this.userSpeed = Math.max(reportedSpeed, derivedSpeed);
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