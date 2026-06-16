// app/src/features/Map/services/LocationService.ts
import * as Location from 'expo-location';
import { Coordinate } from '../models/Location';

export class LocationService {
  static async requestPermission(): Promise<boolean> {
    try {
      const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 10000));
      const result = Location.requestForegroundPermissionsAsync().then(({ status }) => status === 'granted');
      return await Promise.race([result, timeout]);
    } catch (error) {
      return false;
    }
  }

  static async getCurrentLocation(): Promise<Coordinate | null> {
    try {
      // Add timeout to prevent hanging on simulator
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Location timeout')), 10000)
      );

      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const location = await Promise.race([locationPromise, timeoutPromise]);

      if (!location) {
        return null;
      }

      return {
        longitude: location.coords.longitude,
        latitude: location.coords.latitude,
        heading: location.coords.heading !== null ? location.coords.heading : undefined
      };
    } catch {
      return null;
    }
  }

  // Add method to specifically get device heading
  static async getDeviceHeading(): Promise<number> {
    try {
      // Check if heading is available
      const isAvailable = await Location.hasServicesEnabledAsync();
      if (!isAvailable) {
        return 0;
      }

      // Get heading update
      const headingData = await Location.getHeadingAsync();
      return headingData?.magHeading || 0;
    } catch (error) {
      return 0;
    }
  }

  // Watch heading updates, throttled to 500ms to avoid saturating the MobX graph
  static watchHeadingUpdates(callback: (heading: number) => void): { remove: () => void } {
    let subscription: any = null;
    let lastFired = 0;
    const THROTTLE_MS = 500;

    Location.watchHeadingAsync(headingData => {
      const now = Date.now();
      if (now - lastFired < THROTTLE_MS) return;
      lastFired = now;
      callback(headingData.magHeading || 0);
    }).then(sub => {
      subscription = sub;
    });

    return {
      remove: () => {
        if (subscription) subscription.remove();
      }
    };
  }
}