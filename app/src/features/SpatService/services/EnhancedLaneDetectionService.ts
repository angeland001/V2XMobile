// app/src/features/SpatService/services/EnhancedLaneDetectionService.ts

import { 
  GEORGIA_INTERSECTION_LANES, 
  HOUSTON_INTERSECTION_LANES,
  ALL_INTERSECTION_LANES 
} from '../../Lanes/constants/LaneData';
import { Lane } from '../../Lanes/models/LaneTypes';

export interface LaneDetectionResult {
  isInLane: boolean;
  intersection: 'georgia' | 'houston' | null;
  laneId: number | null;
  signalGroup: number | null;
  laneName: string;
}

export class EnhancedLaneDetectionService {
  // Detection threshold: ~4 meters in coordinate units (for lane width)
  private static readonly LANE_WIDTH_THRESHOLD = 0.00004; // About 4 meters

  /**
   * Detect which lane the user is in across all intersections
   */
  static detectUserLane(userPosition: [number, number]): LaneDetectionResult {
    // Check Georgia intersection lanes
    const georgiaLane = this.detectLaneInIntersection(userPosition, GEORGIA_INTERSECTION_LANES, 'georgia');
    if (georgiaLane.isInLane) {
      return georgiaLane;
    }

    // Check Houston intersection lanes
    const houstonLane = this.detectLaneInIntersection(userPosition, HOUSTON_INTERSECTION_LANES, 'houston');
    if (houstonLane.isInLane) {
      return houstonLane;
    }

    // Not in any lane
    return {
      isInLane: false,
      intersection: null,
      laneId: null,
      signalGroup: null,
      laneName: 'Not in any lane'
    };
  }

  /**
   * Detect lane within a specific intersection
   */
  private static detectLaneInIntersection(
    userPosition: [number, number],
    lanes: Lane[],
    intersection: 'georgia' | 'houston'
  ): LaneDetectionResult {
    for (const lane of lanes) {
      if (this.isUserInLane(userPosition, lane)) {
        const signalGroup = lane.connectsTo?.[0]?.signalGroup || null;
        
        return {
          isInLane: true,
          intersection,
          laneId: lane.laneID,
          signalGroup,
          laneName: `${intersection === 'georgia' ? 'Georgia' : 'Houston'} Lane ${lane.laneID}`
        };
      }
    }

    return {
      isInLane: false,
      intersection: null,
      laneId: null,
      signalGroup: null,
      laneName: 'Not in lane'
    };
  }

  /**
   * Check if user is within a specific lane geometry
   */
  private static isUserInLane(userPosition: [number, number], lane: Lane): boolean {
    const coordinates = lane.geometry.coordinates;
    
    if (coordinates.length < 2) {
      return false;
    }

    // Lane coordinates are in [lng, lat] format
    // Convert to [lat, lng] for calculation
    const lanePoints = coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);

    // Check distance to each segment of the lane
    for (let i = 0; i < lanePoints.length - 1; i++) {
      const distance = this.distanceToLineSegment(
        userPosition,
        lanePoints[i],
        lanePoints[i + 1]
      );

      if (distance <= this.LANE_WIDTH_THRESHOLD) {
        return true;
      }
    }

    return false;
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
      // Line start and end are the same point
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // Project point onto line
    const t = Math.max(0, Math.min(1,
      ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / lineLength2
    ));

    const closestX = x1 + t * (x2 - x1);
    const closestY = y1 + t * (y2 - y1);

    return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
  }

  /**
   * Get signal group for a specific lane ID
   */
  static getSignalGroupForLane(laneId: number, intersection: 'georgia' | 'houston'): number | null {
    const lanes = intersection === 'georgia' ? GEORGIA_INTERSECTION_LANES : HOUSTON_INTERSECTION_LANES;
    const lane = lanes.find(l => l.laneID === laneId);
    return lane?.connectsTo?.[0]?.signalGroup || null;
  }

  /**
   * Debug method to get all lanes info
   */
  static getAllLanesInfo(): Array<{
    intersection: string;
    laneId: number;
    signalGroup: number | null;
  }> {
    const result: Array<any> = [];

    GEORGIA_INTERSECTION_LANES.forEach(lane => {
      result.push({
        intersection: 'georgia',
        laneId: lane.laneID,
        signalGroup: lane.connectsTo?.[0]?.signalGroup || null
      });
    });

    HOUSTON_INTERSECTION_LANES.forEach(lane => {
      result.push({
        intersection: 'houston',
        laneId: lane.laneID,
        signalGroup: lane.connectsTo?.[0]?.signalGroup || null
      });
    });

    return result;
  }
}

export default EnhancedLaneDetectionService;