// app/src/features/DirectionGuide/services/MapDataService.ts
// Service responsible for calculating allowed turns based on lane data

import { AllowedTurn, TurnType } from '../models/DirectionTypes';
import {
  LaneDetectionService,
  MapEventData,
  MultiLaneMapData
} from '../../SpatService/services/LaneDetectionService';

export class MapDataService {

  /**
   * Calculate allowed turns from lane data (main responsibility)
   */
  public static calculateAllowedTurns(lanes: MapEventData[]): AllowedTurn[] {
    if (lanes.length === 0) {
      return [
        { type: TurnType.LEFT, allowed: false },
        { type: TurnType.STRAIGHT, allowed: false },
        { type: TurnType.RIGHT, allowed: false },
        { type: TurnType.U_TURN, allowed: false },
      ];
    }

    // Combine maneuvers from all lanes using bitwise OR
    let combinedBitmask = 0;
    lanes.forEach(lane => {
      if (lane.maneuvers && lane.maneuvers.length >= 2) {
        combinedBitmask |= lane.maneuvers[1];
      }
    });

    return [
      { type: TurnType.U_TURN, allowed: (combinedBitmask & 1) === 1 },
      { type: TurnType.RIGHT, allowed: (combinedBitmask & 2) === 2 },
      { type: TurnType.LEFT, allowed: (combinedBitmask & 4) === 4 },
      { type: TurnType.STRAIGHT, allowed: (combinedBitmask & 8) === 8 },
    ];
  }

  /**
   * Helper: Get allowed turns for a single lane
   */
  public static getAllowedTurnsForLane(lane: MapEventData): AllowedTurn[] {
    return this.calculateAllowedTurns([lane]);
  }

  /**
   * Helper: Check if a specific turn is allowed in given lanes
   */
  public static isTurnAllowed(lanes: MapEventData[], turnType: TurnType): boolean {
    const allowedTurns = this.calculateAllowedTurns(lanes);
    const turn = allowedTurns.find(t => t.type === turnType);
    return turn ? turn.allowed : false;
  }

  // ========================================
  // Delegation methods to SpatService (for compatibility)
  // ========================================

  /**
   * Delegate to SpatService for lane detection
   */
  public static detectCarInLanes(carPosition: [number, number], allLanesData: MultiLaneMapData): number[] {
    return LaneDetectionService.detectCarInLanes(carPosition, allLanesData);
  }

  /**
   * Delegate to SpatService for lane data
   */
  public static async fetchAllLanesData(): Promise<MultiLaneMapData> {
    return LaneDetectionService.fetchAllLanesData();
  }

  /**
   * Delegate to SpatService for lanes for car position
   */
  public static getLanesForCarPosition(allLanesData: MultiLaneMapData, carPosition: [number, number]): MapEventData[] {
    return LaneDetectionService.getLanesForCarPosition(allLanesData, carPosition);
  }

  /**
   * Process car position data (keeping interface for DirectionGuide)
   */
  public static processCarPositionData(allLanesData: MultiLaneMapData, carPosition: [number, number]) {
    const lanesForTurnCalculation = this.getLanesForCarPosition(allLanesData, carPosition);
    const allAllowedTurns = this.calculateAllowedTurns(lanesForTurnCalculation);

    return {
      intersectionId: allLanesData.intersectionId,
      intersectionName: allLanesData.intersectionName,
      allAllowedTurns,
      totalLanes: lanesForTurnCalculation.length,
      coordinates: [],
      timestamp: allLanesData.timestamp,
    };
  }
}

export default MapDataService;