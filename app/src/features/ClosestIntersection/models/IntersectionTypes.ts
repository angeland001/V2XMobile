// app/src/features/ClosestIntersection/models/IntersectionTypes.ts

export interface Intersection {
  id: string;
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface LocationWithHeading {
  coordinates: [number, number]; // [latitude, longitude]
  heading?: number; // degrees (0-360)
}

export interface DistanceResult {
  intersection: Intersection;
  distance: number; // meters
  isClosest: boolean;
}

export interface ClosestIntersectionResult {
  closestIntersection: Intersection;
  distance: number; // meters
  heading?: number;
  timestamp: number;
}

export default {};