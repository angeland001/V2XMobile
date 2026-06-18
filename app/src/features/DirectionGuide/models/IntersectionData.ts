// app/src/features/DirectionGuide/models/IntersectionData.ts
import { AllowedTurn, ApproachDirection } from './DirectionTypes';

/**
 * Interface representing raw map data from the API for a single lane
 */
export interface MapEventData {
  intersectionId: number;
  intersectionName: string;
  laneId: number;
  laneAttributes: {
    directionalUse: number[];
    sharedWith: number[];
    laneType: [string, number[]];
  };
  maneuvers: number[];
  connectsTo?: Array<{
    signalGroup?: number;
    connectingLane?: {
      lane: number;
      maneuver: string[];
    };
  }>;
  timestamp: string;
  location: {
    type: string;
    coordinates: [number, number][];
  };
}

/**
 * Interface representing multiple lanes data from the API
 */
export interface MultiLaneMapData {
  intersectionId: number;
  intersectionName: string;
  timestamp: string;
  lanes: MapEventData[];
}

/**
 * Interface representing processed intersection data for the view model
 */
export interface ProcessedIntersectionData {
  intersectionId: number;
  intersectionName: string;
  approachDirection: ApproachDirection;
  allAllowedTurns: AllowedTurn[];
  totalLanes: number;
  coordinates: [number, number][];
  timestamp: string;
  signalGroups?: number[]; // SPaT-related signal groups for this intersection
}

export default {};