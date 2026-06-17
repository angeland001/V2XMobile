// app/src/features/Lanes/models/LaneTypes.ts

export interface Lane {
  laneID: number;
  laneAttributes: {
    directionalUse: [number, number];
    sharedWith: [number, number];
    laneType: [string, [number, number]];
  };
  maneuvers: [number, number];
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
  connectsTo: {
    connectingLane: { lane: number };
    signalGroup: number;
  }[];
}

// Legacy interface for backward compatibility with rendering system
export interface LegacyLane {
  id: string;
  name: string;
  coordinates: [number, number][];
  signalGroup?: number;
  visible: boolean;
}

// Adapter functions to convert between formats
export class LaneAdapter {
  static toLegacyLane(lane: Lane): LegacyLane {
    return {
      id: `lane-${lane.laneID}`,
      name: `Lane ${lane.laneID}`,
      coordinates: lane.geometry.coordinates,
      signalGroup: lane.connectsTo[0]?.signalGroup,
      visible: true
    };
  }

  static toLegacyLanes(lanes: Lane[]): LegacyLane[] {
    return lanes.map(lane => this.toLegacyLane(lane));
  }

  static fromLegacyLane(legacyLane: LegacyLane): Lane {
    const laneID = parseInt(legacyLane.id.replace('lane-', ''));
    return {
      laneID,
      laneAttributes: {
        directionalUse: [2, 2],
        sharedWith: [0, 10],
        laneType: ["vehicle", [0, 8]]
      },
      maneuvers: [0, 12],
      geometry: {
        type: "LineString",
        coordinates: legacyLane.coordinates
      },
      connectsTo: legacyLane.signalGroup ? [{
        connectingLane: { lane: laneID },
        signalGroup: legacyLane.signalGroup
      }] : []
    };
  }
}

export interface LaneStyle {
  color: string;
  width: number;
  opacity?: number;
  lineCap?: 'round' | 'square' | 'butt';
  lineJoin?: 'round' | 'bevel' | 'miter';
}

export interface LaneConfiguration {
  lanes: Lane[];
  defaultStyle: LaneStyle;
  visible: boolean;
}

export default {};