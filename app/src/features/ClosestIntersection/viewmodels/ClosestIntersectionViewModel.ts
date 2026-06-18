// app/src/features/ClosestIntersection/viewmodels/ClosestIntersectionViewModel.ts
// PRODUCTION VERSION: Robust SDSM activation on polygon entry

import { makeAutoObservable, runInAction } from 'mobx';
import { INTERSECTION_POLYGONS } from '../constants/IntersectionDefinitions';
import { PolygonDetectionService } from '../services/PolygonDetectionService';
import { VehicleDisplayViewModel } from '../../SDSM/viewmodels/VehicleDisplayViewModel';
import { SpatViewModel } from '../../SpatService/viewModels/SpatViewModel';

export interface LocationProvider {
  (): [number, number]; // Returns [latitude, longitude]
}

export class ClosestIntersectionViewModel {
  // Observable state
  isMonitoring = false;
  isInGeorgiaIntersection = false;
  lastApiCallTime = 0;
  
  // References to other ViewModels
  private vehicleDisplayVM: VehicleDisplayViewModel | null = null;
  private spatVM: SpatViewModel | null = null;
  
  // Private state
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL_MS = 500; // 500ms for fast response
  private readonly MAX_ACTIVATION_RETRIES = 3;
  private activationRetryTimeout: NodeJS.Timeout | null = null;
  private activationAttempts = 0;
  
  // Track state transitions
  private wasInGeorgia = false;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  /**
   * Set references to other ViewModels
   */
  setViewModels(vehicleDisplayVM: VehicleDisplayViewModel, spatVM?: SpatViewModel): void {
    this.vehicleDisplayVM = vehicleDisplayVM;
    this.spatVM = spatVM || null;
  }
  
  /**
   * Start monitoring user position
   */
  startMonitoring(getUserLocation: LocationProvider): void {
    if (this.isMonitoring) return;
    
    runInAction(() => {
      this.isMonitoring = true;
      this.activationAttempts = 0;
    });
    
    // Immediate check on start
    this.checkGeorgiaIntersectionAndActivateSDSM(getUserLocation());
    
    // Fast polling for responsive detection
    this.monitoringInterval = setInterval(() => {
      const userLocation = getUserLocation();
      this.checkGeorgiaIntersectionAndActivateSDSM(userLocation);
    }, this.MONITORING_INTERVAL_MS);
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.activationRetryTimeout) {
      clearTimeout(this.activationRetryTimeout);
      this.activationRetryTimeout = null;
    }
    
    this.safelyStopSDSM();
    
    runInAction(() => {
      this.isMonitoring = false;
      this.isInGeorgiaIntersection = false;
      this.wasInGeorgia = false;
    });
  }
  
  /**
   * Main logic: Check polygon and activate SDSM
   */
  private async checkGeorgiaIntersectionAndActivateSDSM(userLocation: [number, number]): Promise<void> {
    try {
      // Validate position
      if (!this.isValidPosition(userLocation)) {
        return;
      }
      
      // Check if inside Georgia polygon
      const isInGeorgia = PolygonDetectionService.findIntersectionForPosition(
        userLocation,
        INTERSECTION_POLYGONS
      ) !== null;
      
      // Detect transitions
      const hasJustEntered = !this.wasInGeorgia && isInGeorgia;
      const hasJustExited = this.wasInGeorgia && !isInGeorgia;
      
      if (hasJustEntered) {
        // ENTERED Georgia polygon - Activate SDSM
        runInAction(() => {
          this.isInGeorgiaIntersection = true;
          this.lastApiCallTime = Date.now();
          this.activationAttempts = 0;
        });
        
        await this.activateSDSMWithRetry(INTERSECTION_POLYGONS[0]);
        
      } else if (hasJustExited) {
        // EXITED Georgia polygon - Stop SDSM
        this.safelyStopSDSM();
        
        runInAction(() => {
          this.isInGeorgiaIntersection = false;
        });
        
      } else if (isInGeorgia) {
        // Still inside - Verify SDSM is running
        this.verifySDSMIsRunning();
      }
      
      this.wasInGeorgia = isInGeorgia;
      
    } catch (error) {
      // Silent error handling - system will retry
    }
  }
  
  /**
   * Activate SDSM with retry mechanism
   */
  private async activateSDSMWithRetry(intersection: any): Promise<void> {
    if (!this.vehicleDisplayVM) {
      return;
    }
    
    try {
      runInAction(() => {
        this.activationAttempts++;
      });
      
      // Stop existing SDSM (clean slate)
      this.vehicleDisplayVM.stop();
      await this.sleep(100);
      
      // Set API URL and start
      this.vehicleDisplayVM.setApiUrl('georgia');
      this.vehicleDisplayVM.start();
      
      // Verify activation
      await this.sleep(1000);
      
      if (!this.vehicleDisplayVM.isActive && this.activationAttempts < this.MAX_ACTIVATION_RETRIES) {
        // Failed - retry after delay
        this.activationRetryTimeout = setTimeout(() => {
          this.activateSDSMWithRetry(intersection);
        }, 2000);
      }
      
    } catch (error) {
      // Retry on error
      if (this.activationAttempts < this.MAX_ACTIVATION_RETRIES) {
        this.activationRetryTimeout = setTimeout(() => {
          this.activateSDSMWithRetry(intersection);
        }, 2000);
      }
    }
  }
  
  /**
   * Verify SDSM is still running
   */
  private verifySDSMIsRunning(): void {
    if (!this.vehicleDisplayVM) return;
    
    // Reactivate if SDSM stopped unexpectedly
    if (!this.vehicleDisplayVM.isActive && this.isInGeorgiaIntersection) {
      this.vehicleDisplayVM.setApiUrl('georgia');
      this.vehicleDisplayVM.start();
    }
  }
  
  /**
   * Safely stop SDSM
   */
  private safelyStopSDSM(): void {
    try {
      if (this.vehicleDisplayVM) {
        this.vehicleDisplayVM.stop();
      }
    } catch (error) {
      // Silent error handling
    }
  }
  
  /**
   * Validate position coordinates
   */
  private isValidPosition(position: [number, number]): boolean {
    const [lat, lng] = position;
    
    if (lat === 0 && lng === 0) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    if (isNaN(lat) || isNaN(lng)) return false;
    
    return true;
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get current status
   */
  get status(): string {
    if (!this.isMonitoring) return 'Not monitoring';
    if (!this.isInGeorgiaIntersection) return 'Outside Georgia intersection';
    return 'Inside Georgia intersection';
  }
  
  /**
   * Get SDSM status
   */
  get sdsmStatus(): string {
    if (!this.vehicleDisplayVM) return 'SDSM not connected';
    if (!this.vehicleDisplayVM.isActive) return 'SDSM inactive';
    return `SDSM active: ${this.vehicleDisplayVM.vehicleCount} vehicles`;
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();

    if (this.activationRetryTimeout) {
      clearTimeout(this.activationRetryTimeout);
      this.activationRetryTimeout = null;
    }

    this.vehicleDisplayVM = null;
    this.spatVM = null;
  }
}

export default ClosestIntersectionViewModel;