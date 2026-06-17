// app/src/features/SpatService/services/LaneDetectionService.ts
// Service responsible for lane detection and proximity calculations

import { INTERSECTION_LANES } from '../../Lanes/constants/LaneData';

export interface LaneDefinition {
  id: number;
  coords: [[number, number], [number, number]]; // [start, end] coordinates
  signalGroup: number;
}

export interface MapEventData {
  intersectionId: string;
  intersectionName: string;
  laneId: number;
  laneAttributes: any;
  maneuvers: number[];
  connectsTo: any[];
  timestamp: string;
  location: {
    type: string;
    coordinates: [number, number][];
  };
}

export interface MultiLaneMapData {
  intersectionId: string;
  intersectionName: string;
  timestamp: string;
  lanes: MapEventData[];
}

export class LaneDetectionService {
  // Detection threshold: ~50 meters in coordinate units
  private static readonly DETECTION_THRESHOLD = 0.0005;

  // Lane definitions extracted from INTERSECTION_LANES
  private static readonly LANES: LaneDefinition[] = INTERSECTION_LANES.map(lane => ({
    id: lane.laneID,
    coords: [lane.geometry.coordinates[0], lane.geometry.coordinates[1]] as [[number, number], [number, number]],
    signalGroup: lane.connectsTo[0]?.signalGroup || 0
  }));

  // Lane groups for DirectionGuide compatibility
  private static readonly LANE_GROUPS = [
    {
      groupId: 'road_4_5',
      lanes: [4, 5],
      description: 'MLK Jr Blvd approach'
    },
    {
      groupId: 'road_8',
      lanes: [8],
      description: 'MLK Jr Blvd approach'
    }
  ];

  /**
   * Find the closest lane to user position
   */
  static findClosestLane(userPosition: [number, number]): LaneDefinition | null {
    if (!userPosition || userPosition[0] === 0 || userPosition[1] === 0) {
      return null;
    }

    let closestLane: LaneDefinition | null = null;
    let minDistance = this.DETECTION_THRESHOLD;

    for (const lane of this.LANES) {
      // Convert from [lng, lat] to [lat, lng] for calculation
      const start: [number, number] = [lane.coords[0][1], lane.coords[0][0]];
      const end: [number, number] = [lane.coords[1][1], lane.coords[1][0]];

      const distance = this.distanceToLineSegment(userPosition, start, end);

      if (distance < minDistance) {
        minDistance = distance;
        closestLane = lane;
      }
    }

    return closestLane;
  }

  /**
   * Get all lanes (for reference)
   */
  static getAllLanes(): LaneDefinition[] {
    return [...this.LANES];
  }

  /**
   * Get signal group for a lane ID
   */
  static getSignalGroupForLane(laneId: number): number | null {
    const lane = this.LANES.find(l => l.id === laneId);
    return lane ? lane.signalGroup : null;
  }

  /**
   * Detect which lanes the car is in (for DirectionGuide compatibility)
   */
  static detectCarInLanes(carPosition: [number, number], allLanesData: MultiLaneMapData): number[] {
    const detectedLanes: number[] = [];

    for (const lane of allLanesData.lanes) {
      if (this.isCarOnLane(carPosition, lane)) {
        detectedLanes.push(lane.laneId);
      }
    }

    return detectedLanes;
  }

  /**
   * Check if car is on a specific lane using MapEventData format
   */
  static isCarOnLane(carPosition: [number, number], lane: MapEventData): boolean {
    const coordinates = lane.location.coordinates;

    if (coordinates.length < 2) {
      return false;
    }

    // Convert from [lng, lat] to [lat, lng]
    const startPoint: [number, number] = [coordinates[0][1], coordinates[0][0]];
    const endPoint: [number, number] = [coordinates[coordinates.length - 1][1], coordinates[coordinates.length - 1][0]];

    const distanceToLane = this.distanceToLineSegment(carPosition, startPoint, endPoint);
    return distanceToLane <= this.DETECTION_THRESHOLD;
  }

  /**
   * Get lane group for detected lanes (for DirectionGuide)
   */
  static getLaneGroupForDetectedLanes(detectedLanes: number[]): number[] {
    if (detectedLanes.length === 0) return [];

    for (const group of this.LANE_GROUPS) {
      if (detectedLanes.some(laneId => group.lanes.includes(laneId))) {
        return group.lanes;
      }
    }

    return detectedLanes;
  }

  /**
   * Get lanes for car position (for DirectionGuide)
   */
  static getLanesForCarPosition(allLanesData: MultiLaneMapData, carPosition: [number, number]): MapEventData[] {
    const detectedLanes = this.detectCarInLanes(carPosition, allLanesData);
    const laneGroupIds = this.getLaneGroupForDetectedLanes(detectedLanes);
    return allLanesData.lanes.filter(lane => laneGroupIds.includes(lane.laneId));
  }

  /**
   * Fetch all lanes data (for DirectionGuide compatibility)
   */
  static async fetchAllLanesData(): Promise<MultiLaneMapData> {
    const lanes: MapEventData[] = INTERSECTION_LANES.map(lane => ({
      intersectionId: 'MLK_INTERSECTION',
      intersectionName: 'MLK Jr Blvd & Georgia Ave',
      laneId: lane.laneID,
      laneAttributes: lane.laneAttributes,
      maneuvers: lane.maneuvers,
      connectsTo: lane.connectsTo,
      timestamp: new Date().toISOString(),
      location: {
        type: lane.geometry.type,
        coordinates: lane.geometry.coordinates
      }
    }));

    return {
      intersectionId: 'MLK_INTERSECTION',
      intersectionName: 'MLK Jr Blvd & Georgia Ave',
      timestamp: new Date().toISOString(),
      lanes: lanes
    };
  }

  /**
   * Calculate distance from point to line segment
   */
  private static distanceToLineSegment(
    point: [number, number],
    lineStart: [number, number],
    lineEnd: [number, number]
  ): number {
    const [px, py] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const lineLength2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (lineLength2 === 0) {
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    const t = Math.max(0, Math.min(1,
      ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lineLength2
    ));

    const closestX = x1 + t * (x2 - x1);
    const closestY = y1 + t * (y2 - y1);

    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
  }
}

export default LaneDetectionService;