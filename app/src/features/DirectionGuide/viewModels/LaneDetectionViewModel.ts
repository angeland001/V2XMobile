// app/src/features/DirectionGuide/viewModels/LaneDetectionViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { MapDataService } from '../services/MapDataService';
import { LaneDetectionState, LaneDetectionConfig, DEFAULT_LANE_DETECTION_CONFIG } from '../models/LaneDetectionModels';
import { MultiLaneMapData } from '../models/IntersectionData';

/**
 * ViewModel responsible for lane detection logic
 * Handles vehicle position tracking and lane detection calculations
 */
export class LaneDetectionViewModel {
  // State
  private _vehiclePosition: [number, number] = [0, 0];
  private _detectionState: LaneDetectionState = {
    detectedLaneIds: [],
    currentApproachName: '',
    isInAnyLane: false,
    lastDetectionTime: 0
  };
  
  // Configuration
  private config: LaneDetectionConfig = DEFAULT_LANE_DETECTION_CONFIG;
  
  // Data cache
  private lanesDataCache: MultiLaneMapData | null = null;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  // ========================================
  // Public Getters
  // ========================================
  
  get vehiclePosition(): [number, number] {
    return this._vehiclePosition;
  }
  
  get detectedLaneIds(): number[] {
    return this._detectionState.detectedLaneIds;
  }
  
  get currentApproachName(): string {
    return this._detectionState.currentApproachName;
  }
  
  get isInAnyLane(): boolean {
    return this._detectionState.isInAnyLane;
  }
  
  get currentLanes(): string {
    if (this._detectionState.detectedLaneIds.length === 0) return '';
    
    if (this._detectionState.detectedLaneIds.length === 1) {
      return `${this._detectionState.detectedLaneIds[0]}`;
    } else {
      return this._detectionState.detectedLaneIds.join(' & ');
    }
  }
  
  // ========================================
  // Public Methods
  // ========================================
  
  /**
   * Initialize lane detection with data
   */
  async initialize(): Promise<void> {
    try {
      // Pre-cache intersection data
      this.lanesDataCache = await MapDataService.fetchAllLanesData();
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Update vehicle position and trigger detection
   */
  setVehiclePosition(position: [number, number]): boolean {
    this._vehiclePosition = position;
    
    // Throttle detection to avoid excessive processing
    const now = Date.now();
    if (now - this._detectionState.lastDetectionTime < this.config.detectionThrottleMs) {
      return false; // No detection performed
    }
    
    return this.performLaneDetection();
  }
  
  /**
   * Check if vehicle is in a specific lane
   */
  isInLane(laneId: number): boolean {
    return this._detectionState.detectedLaneIds.includes(laneId);
  }
  
  
  /**
   * Get lanes data for current position
   */
  getLanesForPosition(): any[] {
    if (!this.lanesDataCache) {
      return [];
    }
    
    return MapDataService.getLanesForCarPosition(
      this.lanesDataCache,
      this._vehiclePosition
    );
  }
  
  /**
   * Force refresh cached data
   */
  async refreshData(): Promise<void> {
    this.lanesDataCache = null;
    await this.initialize();
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    runInAction(() => {
      this._detectionState = {
        detectedLaneIds: [],
        currentApproachName: '',
        isInAnyLane: false,
        lastDetectionTime: 0
      };
      this.lanesDataCache = null;
    });
  }
  
  // ========================================
  // Private Methods
  // ========================================
  
  /**
   * Perform actual lane detection
   */
  private performLaneDetection(): boolean {
    if (!this.lanesDataCache) {
      return false;
    }
    
    if (this._vehiclePosition[0] === 0 && this._vehiclePosition[1] === 0) {
      return false;
    }
    
    try {
      // Detect which lanes the car is actually inside
      const detectedLanes = MapDataService.detectCarInLanes(this._vehiclePosition, this.lanesDataCache);
      
      // Check if lanes changed
      const hasChangedLanes = !this.arraysEqual(detectedLanes, this._detectionState.detectedLaneIds);
      
      if (hasChangedLanes) {
        const isInAnyLane = detectedLanes.length > 0;
        const approachName = this.determineApproachName(detectedLanes);
        
        runInAction(() => {
          this._detectionState = {
            detectedLaneIds: detectedLanes,
            currentApproachName: approachName,
            isInAnyLane,
            lastDetectionTime: Date.now()
          };
        });
        
        return true; // Detection changed
      }
      
      // Update timestamp even if no change
      runInAction(() => {
        this._detectionState.lastDetectionTime = Date.now();
      });
      
      return false; // No change in detection
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Determine approach name based on detected lanes
   */
  private determineApproachName(detectedLanes: number[]): string {
    if (detectedLanes.length === 0) {
      return 'Not in any lane';
    }
    
    // Check for specific lane groups
    if (detectedLanes.includes(4) || detectedLanes.includes(5) || detectedLanes.includes(8)) {
      return 'MLK Jr Blvd approach';
    }
    
    return `Lane group containing ${detectedLanes.join(' & ')}`;
  }
  
  /**
   * Helper to compare arrays
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }
}

export default LaneDetectionViewModel;