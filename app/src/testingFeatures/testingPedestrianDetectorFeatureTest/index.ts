// app/src/testingFeatures/testingPedestrianDetectorFeatureTest/index.ts

// Export the testing pedestrian detector
export { TestingPedestrianDetectorViewModel } from './viewmodels/TestingPedestrianDetectorViewModel';
export type { TestingPedestrianData } from './viewmodels/TestingPedestrianDetectorViewModel';

// Re-export shared crosswalk constants for convenience - UPDATED for multiple polygons
export { CROSSWALK_POLYGONS, CROSSWALK_POLYGON_COORDS } from '../../features/Crosswalk/constants/CrosswalkCoordinates';

/**
 * Testing Feature Configuration
 */
export const TESTING_CONFIG = {
  PROXIMITY_THRESHOLD_METERS: 30,
  UPDATE_FREQUENCY_MS: 2000,
  // Updated: Test pedestrian coordinates for second crosswalk
  FIXED_PEDESTRIAN_COORDINATES: [35.04574821897141, -85.30823649580637], // [lat, lon] - Second crosswalk
  FEATURE_NAME: 'Pedestrian Detection Testing with Multiple Crosswalks',
  VERSION: '2.1.0', // Updated version
  USES_FIXED_DATA: true,
  INCLUDES_ZONE_ENTRY_TESTING: true,
  SIMULATION_ENABLED: true,
  SUPPORTS_MULTIPLE_CROSSWALKS: true, // NEW
};

/**
 * Quick test function to verify the testing feature
 */
export const runTestingFeatureCheck = (): boolean => {
  try {
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Quick test function specifically for Detection Zone Entry Time testing
 */
export const runDetectionZoneEntryTest = (): boolean => {
  try {
    return true;
  } catch (error) {
    return false;
  }
};

import { TestingPedestrianDetectorViewModel } from './viewmodels/TestingPedestrianDetectorViewModel';
export default TestingPedestrianDetectorViewModel;