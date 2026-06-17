// app/src/features/PedestrianDetector/services/ProximityDetectionService.ts
// Handles vehicle-pedestrian proximity detection and distance calculations

import { PedestrianErrorHandler } from '../errorHandling/PedestrianErrorHandler';

export class ProximityDetectionService {
  // Distance threshold in coordinate units (approximately 10 meters)
  private static readonly PROXIMITY_WARNING_DISTANCE = 0.0003;
  
  /**
   * Check if vehicle is close to a specific pedestrian position
   */
  public static isVehicleCloseToPosition(
    vehiclePosition: [number, number],
    pedestrianPosition: [number, number]
  ): boolean {
    try {
      if (!this.validatePosition(vehiclePosition) || !this.validatePosition(pedestrianPosition)) {
        return false;
      }
      
      const distance = this.calculateDistance(vehiclePosition, pedestrianPosition);
      return distance <= this.PROXIMITY_WARNING_DISTANCE;
      
    } catch (error) {
      PedestrianErrorHandler.logError('isVehicleCloseToPosition', error);
      return false;
    }
  }
  
  /**
   * Check if vehicle is close to any pedestrian in a list
   */
  public static isVehicleNearAnyPedestrian(
    vehiclePosition: [number, number],
    pedestrians: Array<{ coordinates: [number, number] }>
  ): boolean {
    try {
      return pedestrians.some(pedestrian => 
        this.isVehicleCloseToPosition(vehiclePosition, pedestrian.coordinates)
      );
    } catch (error) {
      PedestrianErrorHandler.logError('isVehicleNearAnyPedestrian', error);
      return false;
    }
  }
  
  /**
   * Get pedestrians that are close to the vehicle
   */
  public static getNearbyPedestrians<T extends { coordinates: [number, number] }>(
    vehiclePosition: [number, number],
    pedestrians: T[]
  ): T[] {
    try {
      return pedestrians.filter(pedestrian => 
        this.isVehicleCloseToPosition(vehiclePosition, pedestrian.coordinates)
      );
    } catch (error) {
      PedestrianErrorHandler.logError('getNearbyPedestrians', error);
      return [];
    }
  }
  
  /**
   * Calculate distance between vehicle and pedestrian in approximate meters
   */
  public static getDistanceInMeters(
    vehiclePosition: [number, number],
    pedestrianPosition: [number, number]
  ): number {
    try {
      const distance = this.calculateDistance(vehiclePosition, pedestrianPosition);
      return distance * 100000; // Convert to approximate meters
    } catch (error) {
      PedestrianErrorHandler.logError('getDistanceInMeters', error);
      return Infinity;
    }
  }
  
  /**
   * Get detailed proximity info for a pedestrian
   */
  public static getProximityInfo(
    vehiclePosition: [number, number],
    pedestrianPosition: [number, number],
    pedestrianId: number
  ): {
    isClose: boolean;
    distanceMeters: number;
    pedestrianId: number;
  } {
    const isClose = this.isVehicleCloseToPosition(vehiclePosition, pedestrianPosition);
    const distanceMeters = this.getDistanceInMeters(vehiclePosition, pedestrianPosition);
    
    return {
      isClose,
      distanceMeters,
      pedestrianId
    };
  }
  
  /**
   * Set custom proximity threshold (for testing or different scenarios)
   */
  public static setCustomThreshold(thresholdInMeters: number): number {
    const thresholdInCoordinateUnits = thresholdInMeters / 100000;
    // Note: This would require making PROXIMITY_WARNING_DISTANCE non-readonly
    // For now, just return the converted value for external use
    return thresholdInCoordinateUnits;
  }
  
  /**
   * Get current threshold in meters
   */
  public static getThresholdInMeters(): number {
    return this.PROXIMITY_WARNING_DISTANCE * 100000;
  }
  
  // ========================================
  // Private Helper Methods
  // ========================================
  
  /**
   * Simple distance calculation between two points using coordinate units
   */
  private static calculateDistance(
    position1: [number, number],
    position2: [number, number]
  ): number {
    const [lat1, lon1] = position1;
    const [lat2, lon2] = position2;
    
    return Math.sqrt(
      Math.pow(lat2 - lat1, 2) + 
      Math.pow(lon2 - lon1, 2)
    );
  }
  
  /**
   * Validate position coordinates
   */
  private static validatePosition(position: [number, number]): boolean {
    if (!position || position.length !== 2) {
      return false;
    }
    
    const [lat, lng] = position;
    
    // Check for valid coordinate ranges and not NaN
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180 &&
           !(lat === 0 && lng === 0); // Exclude null island
  }
  
  /**
   * Log proximity warning for debugging
   */
  public static logProximityWarning(
    vehiclePosition: [number, number],
    pedestrianPosition: [number, number],
    pedestrianId: number
  ): void {
    const distance = this.getDistanceInMeters(vehiclePosition, pedestrianPosition);
  }
}

export default ProximityDetectionService;