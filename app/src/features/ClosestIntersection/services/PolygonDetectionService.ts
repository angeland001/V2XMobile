// app/src/features/ClosestIntersection/services/PolygonDetectionService.ts

import { IntersectionPolygon } from '../constants/IntersectionDefinitions';

export class PolygonDetectionService {
  /**
   * Check if a point is inside a polygon using ray casting algorithm
   * @param point [lat, lng] format from GPS
   * @param polygon Array of [lng, lat] coordinates.
   */
  static isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [lat, lng] = point;
    let inside = false;
    
    // Polygon vertices are in [lng, lat] format, need to work with [lat, lng]
    const vertices: [number, number][] = polygon.map(([pLng, pLat]) => [pLat, pLng]);
    
    // Remove duplicate last point if polygon is closed
    const cleanVertices = this.ensureOpenPolygon(vertices);
    
    for (let i = 0, j = cleanVertices.length - 1; i < cleanVertices.length; j = i++) {
      const [latI, lngI] = cleanVertices[i];
      const [latJ, lngJ] = cleanVertices[j];
      
      if ((latI > lat) !== (latJ > lat) &&
          lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI) {
        inside = !inside;
      }
    }
    
    return inside;
  }
  
  /**
   * Find which intersection polygon contains the user position
   * @param userPosition [lat, lng] format from GPS
   * @param intersections Array of intersection polygons
   */
  static findIntersectionForPosition(
    userPosition: [number, number],
    intersections: IntersectionPolygon[]
  ): IntersectionPolygon | null {
    // Validate user position
    if (!userPosition || userPosition[0] === 0 || userPosition[1] === 0) {
      return null;
    }
    
    const [lat, lng] = userPosition;
    
    // Validate coordinates are in reasonable range
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    
    // Check each intersection
    for (const intersection of intersections) {
      if (this.isPointInPolygon(userPosition, intersection.polygon)) {
        return intersection;
      }
    }
    
    return null;
  }
  
  /**
   * Ensure polygon is open (remove duplicate last point if it matches first)
   */
  private static ensureOpenPolygon(vertices: [number, number][]): [number, number][] {
    if (vertices.length > 0 && 
        vertices[0][0] === vertices[vertices.length - 1][0] && 
        vertices[0][1] === vertices[vertices.length - 1][1]) {
      return vertices.slice(0, -1);
    }
    return vertices;
  }
  
  /**
   * Get polygon bounds for debugging
   */
  static getPolygonBounds(polygon: [number, number][]): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    // Polygon is in [lng, lat] format
    const lats = polygon.map(([lng, lat]) => lat);
    const lngs = polygon.map(([lng, lat]) => lng);
    
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs)
    };
  }
}
