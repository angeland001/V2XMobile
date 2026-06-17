// app/src/features/PedestrianDetector/services/PedestrianWarningService.ts
// Handles warning notifications and alerts

export interface PedestrianAlert {
  timestamp: string;
  pedestrianCount: number;
  isVehicleApproaching: boolean;
  pedestrianIds: number[];
  vehiclePosition: [number, number];
  distanceToNearestPedestrian?: number;
}

export class PedestrianWarningService {
  
  /**
   * Log a simple warning about pedestrians in the crosswalk
   */
  static logPedestrianWarning(pedestrianCount: number): void {
  }
  
  /**
   * Log a detailed alert with comprehensive information
   */
  static logDetailedAlert(alert: PedestrianAlert): void {
    const timeString = new Date(alert.timestamp).toLocaleTimeString();
    const approachingText = alert.isVehicleApproaching ? 'YES' : 'NO';
    const distanceText = alert.distanceToNearestPedestrian 
      ? `${alert.distanceToNearestPedestrian.toFixed(2)}m` 
      : 'N/A';
  }
  
  /**
   * Log a critical warning for immediate danger
   */
  static logCriticalWarning(
    pedestrianId: number, 
    distanceMeters: number,
    vehiclePosition: [number, number],
    pedestrianPosition: [number, number]
  ): void {
    // Critical warning logic would go here
  }
  
  /**
   * Create a standardized alert object
   */
  static createAlert(
    pedestrianCount: number,
    isVehicleApproaching: boolean,
    pedestrianIds: number[],
    vehiclePosition: [number, number],
    distanceToNearestPedestrian?: number
  ): PedestrianAlert {
    return {
      timestamp: new Date().toISOString(),
      pedestrianCount,
      isVehicleApproaching,
      pedestrianIds,
      vehiclePosition,
      distanceToNearestPedestrian
    };
  }
  
  /**
   * Determine alert level based on conditions
   */
  static getAlertLevel(
    pedestriansInCrosswalk: number,
    isVehicleApproaching: boolean,
    distanceToNearest: number
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (pedestriansInCrosswalk === 0) {
      return 'none';
    }
    
    if (!isVehicleApproaching) {
      return 'low';
    }
    
    if (distanceToNearest > 50) {
      return 'medium';
    }
    
    if (distanceToNearest > 20) {
      return 'high';
    }
    
    return 'critical';
  }
  
  /**
   * Log appropriate warning based on alert level
   */
  static logAlertByLevel(
    level: 'none' | 'low' | 'medium' | 'high' | 'critical',
    alert: PedestrianAlert
  ): void {
    switch (level) {
      case 'none':
        // No warning needed
        break;
      case 'low':
        break;
      case 'medium':
      case 'high':
        this.logDetailedAlert(alert);
        break;
      case 'critical':
        this.logDetailedAlert(alert);
        // Could trigger additional critical alerts here
        break;
    }
  }
  
  /**
   * Format distance for display
   */
  static formatDistance(distanceMeters: number): string {
    if (distanceMeters < 1) {
      return `${(distanceMeters * 100).toFixed(0)}cm`;
    } else if (distanceMeters < 1000) {
      return `${distanceMeters.toFixed(1)}m`;
    } else {
      return `${(distanceMeters / 1000).toFixed(2)}km`;
    }
  }
}

export default PedestrianWarningService;