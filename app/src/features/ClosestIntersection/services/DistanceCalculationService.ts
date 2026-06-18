// app/src/features/ClosestIntersection/services/DistanceCalculationService.ts

import { Intersection, LocationWithHeading, DistanceResult } from '../models/IntersectionTypes';

export class DistanceCalculationService {
  
  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in meters
   */
  static calculateDistance(
    point1: [number, number], // [lat, lng]
    point2: [number, number]  // [lng, lat] (intersection format)
  ): number {
    const [lat1, lng1] = point1;
    const [lng2, lat2] = point2; // Convert intersection format
    
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  /**
   * Calculate distances to all intersections
   */
  static calculateDistancesToIntersections(
    userLocation: LocationWithHeading,
    intersections: Intersection[]
  ): DistanceResult[] {
    const results = intersections.map(intersection => ({
      intersection,
      distance: this.calculateDistance(userLocation.coordinates, intersection.coordinates),
      isClosest: false
    }));

    // Mark the closest one
    if (results.length > 0) {
      const closestIndex = results.reduce((minIndex, current, index) => 
        current.distance < results[minIndex].distance ? index : minIndex, 0
      );
      results[closestIndex].isClosest = true;
    }

    return results;
  }

  /**
   * Find the closest intersection considering heading (future enhancement)
   */
  static findClosestIntersection(
    userLocation: LocationWithHeading,
    intersections: Intersection[]
  ): DistanceResult | null {
    const results = this.calculateDistancesToIntersections(userLocation, intersections);
    return results.find(result => result.isClosest) || null;
  }

  /**
   * Calculate bearing from user to intersection (for future heading consideration)
   */
  static calculateBearing(
    from: [number, number], // [lat, lng]
    to: [number, number]    // [lng, lat]
  ): number {
    const [lat1, lng1] = from;
    const [lng2, lat2] = to;

    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return ((θ * 180 / Math.PI) + 360) % 360; // Normalize to 0-360
  }
}

export default DistanceCalculationService;