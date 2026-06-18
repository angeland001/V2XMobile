// app/src/features/DirectionGuide/models/LaneDetectionModels.ts

/**
 * Lane detection specific models and types
 */

export interface DetectedLane {
  laneId: number;
  isActive: boolean;
  detectionTime: number;
}

export interface LaneDetectionState {
  detectedLaneIds: number[];
  currentApproachName: string;
  isInAnyLane: boolean;
  lastDetectionTime: number;
}

export interface LaneDetectionConfig {
  detectionThrottleMs: number;
  laneWidthThreshold: number;
  metersToCoordRatio: number;
}

export interface LaneGroup {
  groupId: string;
  lanes: number[];
  description: string;
}

export const DEFAULT_LANE_DETECTION_CONFIG: LaneDetectionConfig = {
  detectionThrottleMs: 250, // Reduced from 500ms to 250ms for faster SPaT response
  laneWidthThreshold: 4.0 * 0.000009, // Increased from 3.5m to 4m for earlier detection
  metersToCoordRatio: 0.000009
};

export default DEFAULT_LANE_DETECTION_CONFIG;