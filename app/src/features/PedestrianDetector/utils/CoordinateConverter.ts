// app/src/features/PedestrianDetector/utils/CoordinateConverter.ts

export interface RefPoint {
  lat: number;  // e.g., 350397934
  lon: number;  // e.g., -852921050
}

export interface OffsetCoordinate {
  x: number;  // longitude offset
  y: number;  // latitude offset
}

export class CoordinateConverter {
  private static readonly COORDINATE_SCALE = 10000000; // 10^7 for conversion

  /**
   * Convert reference point from integer format to decimal degrees
   */
  static convertRefPointToDecimal(refPoint: RefPoint): [number, number] {
    const lat = refPoint.lat / this.COORDINATE_SCALE;
    const lon = refPoint.lon / this.COORDINATE_SCALE;
    return [lon, lat]; // Return as [longitude, latitude] for map rendering.
  }

  /**
   * Convert offset coordinates to real-world coordinates
   */
  static offsetToRealWorld(
    offsetCoordinates: [number, number][], 
    refPoint: RefPoint
  ): [number, number][] {
    const [refLon, refLat] = this.convertRefPointToDecimal(refPoint);
    
    
    return offsetCoordinates.map(([offsetLon, offsetLat]) => {
      const realLon = refLon + offsetLon;
      const realLat = refLat + offsetLat;
      
      
      return [realLon, realLat]; // [longitude, latitude] for map rendering.
    });
  }

  /**
   * Convert a single offset coordinate to real-world
   */
  static singleOffsetToRealWorld(
    offsetCoordinate: [number, number], 
    refPoint: RefPoint
  ): [number, number] {
    return this.offsetToRealWorld([offsetCoordinate], refPoint)[0];
  }
}

// Example usage constants
export const MLK_REF_POINT: RefPoint = {
  lat: 350397934,
  lon: -852921050
};

// Your offset coordinates
export const OFFSET_COORDINATES: [number, number][] = [
  [-85.3125954, 35.0459207], 
  [-85.3132786, 35.0448121]
];

// Convert to real-world coordinates
export const REAL_WORLD_COORDINATES = CoordinateConverter.offsetToRealWorld(
  OFFSET_COORDINATES, 
  MLK_REF_POINT
);
