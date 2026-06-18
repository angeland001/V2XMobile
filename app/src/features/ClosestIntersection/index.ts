// app/src/features/ClosestIntersection/index.ts

import { ClosestIntersectionViewModel } from './viewmodels/ClosestIntersectionViewModel';

// Main exports
export { ClosestIntersectionViewModel } from './viewmodels/ClosestIntersectionViewModel';
export { PolygonDetectionService } from './services/PolygonDetectionService';
export { IntersectionApiService } from './services/IntersectionApiService';
export { INTERSECTION_POLYGONS } from './constants/IntersectionDefinitions';

// Type exports
export type {
  IntersectionPolygon,
} from './constants/IntersectionDefinitions';

export type {
  ApiResponse
} from './services/IntersectionApiService';

export type {
  LocationProvider
} from './viewmodels/ClosestIntersectionViewModel';

// Configuration
export const CLOSEST_INTERSECTION_CONFIG = {
  FEATURE_NAME: 'Polygon-Based Intersection Monitor',
  VERSION: '2.0.0',
  UPDATE_FREQUENCY_MS: 1000,
  DESCRIPTION: 'Monitors user position within intersection polygons and calls appropriate APIs'
};

/**
 * Quick setup function
 */
export const createIntersectionMonitor = (): ClosestIntersectionViewModel => {
  return new ClosestIntersectionViewModel();
};

export default ClosestIntersectionViewModel;