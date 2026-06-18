// app/src/features/PedestrianDetector/viewModels/PedestrianDetectorViewModel.ts
// Clean main ViewModel that coordinates managers and provides public API

import { makeAutoObservable, runInAction } from 'mobx';
import { PedestrianDataManager } from './PedestrianDataManager';
import { CrosswalkDetectionService } from '../services/CrosswalkDetectionService';
import { ProximityDetectionService } from '../services/ProximityDetectionService';
import { PedestrianErrorHandler } from '../errorHandling/PedestrianErrorHandler';
import { VRUData } from '../../SDSM/models/SDSMTypes';

export class PedestrianDetectorViewModel {
  // State
  pedestriansInCrosswalk: number = 0;
  private _vehiclePosition: [number, number] = [0, 0];
  private conditionsMetCallback: (() => void) | null = null;

  // Managers
  private dataManager: PedestrianDataManager;

  constructor() {
    makeAutoObservable(this);

    // Initialize managers
    this.dataManager = new PedestrianDataManager();

    // Removed initialization log to reduce noise
  }

  // ========================================
  // Public API - Vehicle Position
  // ========================================

  /**
   * Get current vehicle position
   */
  get vehiclePosition(): [number, number] {
    return this._vehiclePosition;
  }

  /**
   * Set vehicle position and trigger condition check
   */
  setVehiclePosition(position: [number, number]): void {
    this._vehiclePosition = position;

    // Check conditions immediately when position updates
    if (this.isMonitoring) {
      this.checkConditions();
    }
  }

  /**
   * Set callback function to be called when conditions are met
   */
  setConditionsMetCallback(callback: () => void): void {
    this.conditionsMetCallback = callback;
  }

  /**
   * Update VRU data from SDSM feature
   */
  updateVRUData(vruData: VRUData[]): void {
    this.dataManager.updatePedestrianData(vruData);

    // Check conditions immediately when data updates
    this.checkConditions();
  }

  /**
   * Improved logic: Check if vehicle is within 20m of pedestrians that are IN crosswalk
   * Only returns true when there are VRU pedestrians in crosswalk AND vehicle is close to them
   */
  get isVehicleNearPedestrianInCrosswalk(): boolean {
    // Get pedestrians currently in crosswalk
    const pedestriansInCrosswalk = CrosswalkDetectionService.getPedestriansInCrosswalk(this.dataManager.pedestrians);

    if (pedestriansInCrosswalk.length === 0) {
      return false; // No pedestrians in crosswalk
    }

    // Check if vehicle is within 20m of ANY pedestrian that is in crosswalk
    return pedestriansInCrosswalk.some(pedestrian =>
      ProximityDetectionService.isVehicleCloseToPosition(
        this._vehiclePosition,
        pedestrian.coordinates
      )
    );
  }

  // ========================================
  // Public API - Monitoring
  // ========================================

  /**
   * Get monitoring status (always true when receiving SDSM data)
   */
  get isMonitoring(): boolean {
    return true; // Always monitoring when receiving VRU data from SDSM
  }

  /**
   * Start pedestrian monitoring (no-op, data comes from SDSM)
   */
  startMonitoring(): void {
    // No-op: data comes from SDSM feature
  }

  /**
   * Stop pedestrian monitoring (no-op, data comes from SDSM)
   */
  stopMonitoring(): void {
    // No-op: data comes from SDSM feature
  }

  // ========================================
  // Public API - State Information
  // ========================================

  /**
   * Get loading status (always false since data comes from SDSM)
   */
  get loading(): boolean {
    return false;
  }

  /**
   * Get error status
   */
  get error(): string | null {
    return this.dataManager.error;
  }

  /**
   * Check if data is fresh
   */
  get isDataFresh(): boolean {
    return this.dataManager.isDataFresh();
  }

  /**
   * Get data age in milliseconds
   */
  get dataAge(): number {
    return this.dataManager.getDataAge();
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Check conditions and update crosswalk count
   */
  private checkConditions(): void {
    try {
      let pedestriansInCrosswalkCount = 0;
      let hasMetConditions = false;

      // Check each pedestrian
      this.dataManager.pedestrians.forEach(pedestrian => {
        const isInCrosswalk = CrosswalkDetectionService.isInCrosswalk(pedestrian.coordinates);
        const isCloseToVehicle = ProximityDetectionService.isVehicleCloseToPosition(
          this._vehiclePosition,
          pedestrian.coordinates
        );

        if (isInCrosswalk) {
          pedestriansInCrosswalkCount++;
        }

        if (isCloseToVehicle) {
          ProximityDetectionService.logProximityWarning(
            this._vehiclePosition,
            pedestrian.coordinates,
            pedestrian.id
          );
        }

        // Check if conditions are met (pedestrian in crosswalk AND vehicle is close)
        if (isInCrosswalk && isCloseToVehicle) {
          hasMetConditions = true;
        }
      });

      // Update the observable state
      runInAction(() => {
        this.pedestriansInCrosswalk = pedestriansInCrosswalkCount;
      });


      // Call the callback if conditions are met
      if (hasMetConditions && this.conditionsMetCallback) {
        try {
          this.conditionsMetCallback();
        } catch (error) {
        }
      }

    } catch (error) {
      PedestrianErrorHandler.logError('checkConditions', error);
    }
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.conditionsMetCallback = null;

    runInAction(() => {
      this.pedestriansInCrosswalk = 0;
      this._vehiclePosition = [0, 0];
    });
  }
}

export default PedestrianDetectorViewModel;