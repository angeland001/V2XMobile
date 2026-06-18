// GPS-based heading for moving users (direction of travel)
// Uses Location.watchPositionAsync() to get coords.heading
// This is the direction the user is moving (GPS bearing), not device orientation

import * as Location from 'expo-location';

export interface HeadingData {
  heading: number;
  accuracy: number;
  timestamp: number;
  source: 'compass';
}

export type HeadingCallback = (data: HeadingData) => void;

export interface CalibrationStatus {
  isCalibrated: boolean;
  offset: number;
  quality: 'uncalibrated' | 'calibrating' | 'calibrated';
}

export class HeadingService {
  private static locationSubscription: Location.LocationSubscription | null = null;
  private static callbacks: Set<HeadingCallback> = new Set();

  private static currentHeading: HeadingData = {
    heading: 0,
    accuracy: 0,
    timestamp: Date.now(),
    source: 'compass'
  };
  private static isTracking: boolean = false;
  private static currentSpeed: number = 0;

  static async startTracking(): Promise<void> {
    if (this.isTracking) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Use GPS position updates to get heading (direction of travel)
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 500, // Update every 0.5 seconds (faster updates)
          distanceInterval: 0.5, // Update every 0.5 meters (more sensitive to direction changes)
        },
        (location) => {
          const { heading, speed, accuracy } = location.coords;

          // heading is the direction of travel (GPS bearing)
          // Only update if heading is valid (not null and >= 0)
          if (heading !== null && heading >= 0) {
            this.currentSpeed = speed ?? 0;

            const headingData: HeadingData = {
              heading: parseFloat(heading.toFixed(1)), // Round to 1 decimal
              accuracy: accuracy ?? 0,
              timestamp: Date.now(),
              source: 'compass'
            };

            this.currentHeading = headingData;
            this.notifyCallbacks(headingData);

            console.log(`🧭 [HeadingService] GPS Heading: ${headingData.heading}° Speed: ${(this.currentSpeed * 3.6).toFixed(1)} km/h`);
          } else {
            console.log('⏸️ [HeadingService] No heading available (user might be stationary)');
          }
        }
      );

      this.isTracking = true;
      console.log('✅ [HeadingService] GPS heading tracking started');
    } catch (error) {
      console.error('❌ [HeadingService] Failed to start tracking:', error);
      throw error;
    }
  }

  static stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
    this.isTracking = false;
    console.log('⏹️ [HeadingService] Tracking stopped');
  }

  static getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  static subscribe(callback: HeadingCallback): () => void {
    this.callbacks.add(callback);
    if (this.currentHeading.heading !== 0) {
      callback(this.currentHeading);
    }
    return () => this.callbacks.delete(callback);
  }

  static getCurrentHeading(): HeadingData {
    return { ...this.currentHeading };
  }

  static getCalibrationStatus(): CalibrationStatus {
    // With native compass API, calibration is handled by the OS
    // We report based on accuracy from the sensor
    const isCalibrated = this.currentHeading.accuracy >= 0;
    const quality: 'uncalibrated' | 'calibrating' | 'calibrated' =
      this.currentHeading.accuracy >= 0 ? 'calibrated' : 'uncalibrated';

    return {
      isCalibrated,
      offset: 0, // No manual calibration needed
      quality
    };
  }

  static getCardinalDirection(heading: number): string {
    const normalized = ((heading % 360) + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(normalized / 45) % 8;
    return directions[index];
  }

  static resetCalibration(): void {
    // Calibration is handled by the OS, nothing to reset
    console.log('🔄 [HeadingService] Using OS-managed calibration');
  }

  private static notifyCallbacks(data: HeadingData): void {
    this.callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in heading callback:', error);
      }
    });
  }

  static isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  static cleanup(): void {
    this.stopTracking();
    this.callbacks.clear();
    this.currentHeading = {
      heading: 0,
      accuracy: 0,
      timestamp: Date.now(),
      source: 'compass'
    };
  }
}

export default HeadingService;
