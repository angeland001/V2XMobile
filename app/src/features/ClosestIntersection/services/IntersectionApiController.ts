// app/src/features/ClosestIntersection/services/IntersectionApiController.ts

import { INTERSECTIONS } from '../constants/IntersectionDefinitions';
import { DistanceCalculationService } from './DistanceCalculationService';
import { LocationWithHeading } from '../models/IntersectionTypes';
import { VehicleDisplayViewModel } from '../../SDSM/viewmodels/VehicleDisplayViewModel';

export class IntersectionApiController {
  private static readonly PROXIMITY_THRESHOLD = 60; // meters
  private static readonly HEADING_TOLERANCE = 45; // degrees
  private static readonly PASSED_THRESHOLD = 10; // meters behind intersection
  private static isMonitoring = false;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static readonly MONITORING_INTERVAL_MS = 500; // Check every 500ms for responsiveness
  private static vehicleDisplayViewModel: VehicleDisplayViewModel | null = null;
  private static currentActiveIntersection: string | null = null;
  private static lastKnownPosition: LocationWithHeading | null = null;

  /**
   * Start monitoring intersection proximity and making conditional API calls
   */
  public static startConditionalApiCalling(
    getUserLocation: () => LocationWithHeading,
    vehicleDisplayVM: VehicleDisplayViewModel
  ): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.vehicleDisplayViewModel = vehicleDisplayVM;

    // Initial check
    this.checkAndUpdateApiState(getUserLocation);

    // Set up interval monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAndUpdateApiState(getUserLocation);
    }, this.MONITORING_INTERVAL_MS);
  }

  /**
   * Stop monitoring
   */
  public static stopConditionalApiCalling(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    
    // Stop any active APIs
    if (this.vehicleDisplayViewModel) {
      this.vehicleDisplayViewModel.stop();
    }
    
    this.currentActiveIntersection = null;
    this.lastKnownPosition = null;
  }

  /**
   * Main logic to check position and update API state
   */
  private static checkAndUpdateApiState(getUserLocation: () => LocationWithHeading): void {
    try {
      const userLocation = getUserLocation();
      this.lastKnownPosition = userLocation;
      
      // Find the best intersection candidate
      const targetIntersection = this.findTargetIntersection(userLocation);
      
      if (targetIntersection) {
        // Vehicle is approaching an intersection
        if (this.currentActiveIntersection !== targetIntersection.id) {
          // Switch to new intersection
          this.activateIntersectionApi(targetIntersection.id);
        }
      } else {
        // No valid intersection - stop APIs immediately
        if (this.currentActiveIntersection) {
          this.deactivateApis();
        }
      }
    } catch (error) {
      // Silent error handling
    }
  }

  /**
   * Find which intersection the vehicle is approaching (if any)
   */
  private static findTargetIntersection(userLocation: LocationWithHeading): any | null {
    const { coordinates, heading } = userLocation;
    
    // No heading data means we can't determine direction
    if (heading === undefined) {
      return null;
    }

    for (const intersection of INTERSECTIONS) {
      const distance = DistanceCalculationService.calculateDistance(
        coordinates, 
        intersection.coordinates
      ) * 111000; // Convert to meters (approximate)
      
      // Check if within proximity threshold
      if (distance > this.PROXIMITY_THRESHOLD) {
        continue;
      }
      
      // Check if vehicle has passed the intersection
      if (this.hasPassedIntersection(coordinates, intersection.coordinates, heading)) {
        continue;
      }
      
      // Check if heading toward intersection
      const bearing = DistanceCalculationService.calculateBearing(
        coordinates, 
        intersection.coordinates
      );
      
      const headingDiff = this.getHeadingDifference(heading, bearing);
      
      if (headingDiff <= this.HEADING_TOLERANCE) {
        return {
          id: intersection.id,
          name: intersection.name,
          distance: distance
        };
      }
    }
    
    return null;
  }

  /**
   * Check if vehicle has passed the intersection
   */
  private static hasPassedIntersection(
    vehiclePos: [number, number],
    intersectionPos: [number, number],
    vehicleHeading: number
  ): boolean {
    // Calculate bearing from intersection to vehicle
    const bearingFromIntersection = DistanceCalculationService.calculateBearing(
      [intersectionPos[1], intersectionPos[0]], // Convert to [lat, lng]
      vehiclePos
    );
    
    // If the bearing from intersection to vehicle is opposite to vehicle heading,
    // then vehicle has passed
    const oppositeBearing = (vehicleHeading + 180) % 360;
    const bearingDiff = this.getHeadingDifference(bearingFromIntersection, oppositeBearing);
    
    // If bearings are similar (within 90 degrees), vehicle has passed
    return bearingDiff < 90;
  }

  /**
   * Activate API for specific intersection
   */
  private static activateIntersectionApi(intersectionId: string): void {
    // Stop current API if different
    if (this.currentActiveIntersection && this.currentActiveIntersection !== intersectionId) {
      this.vehicleDisplayViewModel?.stop();
    }
    
    // Start API for new intersection
    if (this.vehicleDisplayViewModel) {
      const apiEndpoint = intersectionId === 'mlk_georgia' ? 'georgia' : 'houston';
      this.vehicleDisplayViewModel.start(apiEndpoint);
      this.currentActiveIntersection = intersectionId;
    }
  }

  /**
   * Deactivate all APIs immediately
   */
  private static deactivateApis(): void {
    if (this.vehicleDisplayViewModel) {
      this.vehicleDisplayViewModel.stop();
    }
    this.currentActiveIntersection = null;
  }

  /**
   * Calculate heading difference between two angles
   */
  private static getHeadingDifference(heading1: number, heading2: number): number {
    let diff = Math.abs(heading1 - heading2);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }

  /**
   * Cleanup resources
   */
  public static cleanup(): void {
    this.stopConditionalApiCalling();
  }
}

export default IntersectionApiController;