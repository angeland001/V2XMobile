// app/src/features/PedestrianDetector/services/DirectionalCrosswalkDetection.ts
// Service for determining which crosswalk a vehicle is approaching based on heading

import { CROSSWALK_CENTERS } from '../../Crosswalk/constants/CrosswalkCoordinates';

export class DirectionalCrosswalkDetection {
  /**
   * Calculate bearing from vehicle position to crosswalk center
   * vehiclePos is [lat, lon]
   * crosswalkCenter is [lon, lat] - need to swap
   */
  private static calculateBearing(
    vehiclePos: [number, number],
    crosswalkCenter: [number, number]
  ): number {
    const [lat1, lon1] = vehiclePos;          // vehiclePos: [lat, lon]
    const [lon2, lat2] = crosswalkCenter;     // crosswalkCenter: [lon, lat]

    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
  }

  /**
   * Calculate the difference between two headings
   */
  private static getHeadingDifference(heading1: number, heading2: number): number {
    let diff = Math.abs(heading1 - heading2);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }

  /**
   * Determine which crosswalk the vehicle is approaching based on heading
   * Returns the index of the crosswalk the vehicle is most likely approaching,
   * or null if no crosswalk is in the direction of travel
   */
  public static getCrosswalkBeingApproached(
    vehiclePosition: [number, number],
    vehicleHeading: number,
    maxHeadingDifference: number = 45 // degrees
  ): number | null {
    let bestMatch: { index: number; headingDiff: number } | null = null;

    CROSSWALK_CENTERS.forEach((center, index) => {
      // Calculate bearing from vehicle to crosswalk center
      const bearingToCrosswalk = this.calculateBearing(vehiclePosition, center);

      // Calculate how much the vehicle heading differs from the bearing to crosswalk
      const headingDiff = this.getHeadingDifference(vehicleHeading, bearingToCrosswalk);

      // If vehicle is heading towards this crosswalk (within tolerance)
      if (headingDiff <= maxHeadingDifference) {
        // Keep track of the best match (smallest heading difference)
        if (!bestMatch || headingDiff < bestMatch.headingDiff) {
          bestMatch = { index, headingDiff };
        }
      }
    });

    return bestMatch ? bestMatch.index : null;
  }

  /**
   * Check if vehicle is approaching a specific crosswalk
   */
  public static isApproachingCrosswalk(
    vehiclePosition: [number, number],
    vehicleHeading: number,
    crosswalkIndex: number,
    maxHeadingDifference: number = 45
  ): boolean {
    if (crosswalkIndex >= CROSSWALK_CENTERS.length) {
      return false;
    }

    const center = CROSSWALK_CENTERS[crosswalkIndex];
    const bearingToCrosswalk = this.calculateBearing(vehiclePosition, center);
    const headingDiff = this.getHeadingDifference(vehicleHeading, bearingToCrosswalk);

    return headingDiff <= maxHeadingDifference;
  }

  /**
   * Get all crosswalks the vehicle is approaching (in case of multiple close headings)
   */
  public static getAllApproachedCrosswalks(
    vehiclePosition: [number, number],
    vehicleHeading: number,
    maxHeadingDifference: number = 45
  ): number[] {
    interface CrosswalkData {
      index: number;
      bearing: number;
      headingDiff: number;
    }
    const crosswalkData: CrosswalkData[] = [];

    CROSSWALK_CENTERS.forEach((center, index) => {
      const bearingToCrosswalk = this.calculateBearing(vehiclePosition, center);
      const headingDiff = this.getHeadingDifference(vehicleHeading, bearingToCrosswalk);

      crosswalkData.push({
        index,
        bearing: bearingToCrosswalk,
        headingDiff
      });

    });

    // Get crosswalks within tolerance
    const approachedCrosswalks = crosswalkData
      .filter(data => data.headingDiff <= maxHeadingDifference)
      .map(data => data.index);

    // If multiple crosswalks are within tolerance, prefer the one with smallest heading difference
    if (approachedCrosswalks.length > 1) {
      const closest = crosswalkData
        .filter(data => data.headingDiff <= maxHeadingDifference)
        .sort((a, b) => a.headingDiff - b.headingDiff)[0];

      return [closest.index];
    }

    return approachedCrosswalks;
  }
}

export default DirectionalCrosswalkDetection;