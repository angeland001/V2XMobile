// app/src/features/Lanes/services/LaneRenderingService.ts

import { LegacyLane, LaneStyle } from '../models/LaneTypes';
import { DEFAULT_LANE_STYLE } from '../constants/LaneData';

export class LaneRenderingService {

  /**
   * Generate GeoJSON Feature for a lane
   */
  static createLaneFeature(lane: LegacyLane): any {
    return {
      type: "Feature" as const,
      properties: {
        laneId: lane.id,
        name: lane.name,
        visible: lane.visible
      },
      geometry: {
        type: "LineString" as const,
        coordinates: lane.coordinates
      }
    };
  }

  /**
   * Generate map line style using default lane style
   */
  static createLineStyle(): any {
    return {
      lineColor: DEFAULT_LANE_STYLE.color,
      lineWidth: DEFAULT_LANE_STYLE.width,
      lineOpacity: DEFAULT_LANE_STYLE.opacity || 1.0,
      lineCap: DEFAULT_LANE_STYLE.lineCap || 'round',
      lineJoin: DEFAULT_LANE_STYLE.lineJoin || 'round'
    };
  }

  /**
   * Filter visible lanes
   */
  static getVisibleLanes(lanes: LegacyLane[]): LegacyLane[] {
    return lanes.filter(lane => lane.visible);
  }

  /**
   * Update lane visibility
   */
  static toggleLaneVisibility(lanes: LegacyLane[], laneId: string): LegacyLane[] {
    return lanes.map(lane =>
      lane.id === laneId
        ? { ...lane, visible: !lane.visible }
        : lane
    );
  }

  /**
   * Update lane style
   */
  static updateLaneStyle(lanes: LegacyLane[], laneId: string, styleUpdate: Partial<LaneStyle>): LegacyLane[] {
    // Note: LegacyLane doesn't have style properties, so this method doesn't modify lanes
    // but is kept for API compatibility
    return lanes;
  }

  /**
   * Get lane by ID
   */
  static getLaneById(lanes: LegacyLane[], laneId: string): LegacyLane | undefined {
    return lanes.find(lane => lane.id === laneId);
  }

  /**
   * Validate lane coordinates
   */
  static validateLaneCoordinates(coordinates: [number, number][]): boolean {
    if (!coordinates || coordinates.length < 2) {
      return false;
    }

    return coordinates.every(coord => {
      const [lng, lat] = coord;
      return (
        typeof lng === 'number' &&
        typeof lat === 'number' &&
        lng >= -180 && lng <= 180 &&
        lat >= -90 && lat <= 90
      );
    });
  }
}
