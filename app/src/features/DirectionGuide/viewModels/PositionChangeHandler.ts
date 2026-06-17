// app/src/features/DirectionGuide/viewModels/PositionChangeHandler.ts

import { LaneDetectionViewModel } from './LaneDetectionViewModel';
import { TurnDataManager } from './TurnDataManager';

/**
 * Handles the workflow when vehicle position changes
 * Single responsibility: Coordinate position change responses
 */
export class PositionChangeHandler {
  constructor(
    private laneDetection: LaneDetectionViewModel,
    private turnDataManager: TurnDataManager
  ) {}
  
  // ========================================
  // Public Methods
  // ========================================
  
  /**
   * Handle vehicle position change
   * Returns whether the turn guide should be shown
   */
  async handlePositionChange(position: [number, number]): Promise<boolean> {
    try {
      // Step 1: Update lane detection
      const laneDetectionChanged = this.laneDetection.setVehiclePosition(position);

      // Step 2: Check if vehicle entered or left lanes
      const isInAnyLane = this.laneDetection.isInAnyLane;

      if (isInAnyLane && laneDetectionChanged) {
        // Vehicle entered lanes or detection changed - load turn data
        await this.loadTurnDataForCurrentLanes();
      } else if (!isInAnyLane) {
        // Vehicle left lanes - clear data
        this.handleLeftLanes();
      }

      // Always return current lane state
      return isInAnyLane;

    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get current lane information for display
   */
  getLaneInfo(): {
    approachName: string;
    currentLanes: string;
    detectedLaneIds: number[];
  } {
    return {
      approachName: this.laneDetection.currentApproachName,
      currentLanes: this.laneDetection.currentLanes,
      detectedLaneIds: this.laneDetection.detectedLaneIds
    };
  }
  
  /**
   * Check if vehicle is in a specific lane
   */
  isInLane(laneId: number): boolean {
    return this.laneDetection.isInLane(laneId);
  }
  
  // ========================================
  // Private Methods
  // ========================================
  
  /**
   * Handle when vehicle leaves lanes
   */
  private handleLeftLanes(): void {
    // Clear turn data only
    this.turnDataManager.clearTurnData();
  }
  
  /**
   * Load turn data for currently detected lanes
   */
  private async loadTurnDataForCurrentLanes(): Promise<void> {
    try {
      const lanesData = this.laneDetection.getLanesForPosition();
      const vehiclePosition = this.laneDetection.vehiclePosition;
      
      await this.turnDataManager.loadTurnData(lanesData, vehiclePosition);
      
    } catch (error) {
    }
  }
  
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Individual managers handle their own cleanup
    // This handler doesn't own any resources directly
  }
}

export default PositionChangeHandler;