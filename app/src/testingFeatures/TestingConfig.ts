// app/src/testingFeatures/TestingConfig.ts
export const TESTING_CONFIG = {
  // Testing mode toggle
  USE_TESTING_MODE: true,
  USE_VEHICLE_TESTING_FEATURE: true,

  // Toggle to show/hide the fixed testing pedestrian
  SHOW_FIXED_PEDESTRIAN: false,

  // Toggle to enable/disable SDSM API calls and display
  ENABLE_SDSM_API: true,

  // Toggle to show/hide SPaT zone polygons + entry/exit lines on map
  SHOW_SPAT_ZONES: true,

  // Fixed pedestrian coordinates for testing [lat, lon]
  FIXED_PEDESTRIAN_COORDINATES: [35.04573837534117, -85.3081989270337] as [number, number],
  
  // Detection Latency Test Configuration
  DETECTION_LATENCY_TEST: {
    ENABLED: true,
    SIMULATION_INTERVAL_MS: 2000,
    MONITORING_INTERVAL_MS: 100,
    RUN_ONCE: false,
  },

  // ========================================
  // Lane Overlay Toggles for Each Intersection
  // ========================================
  LANE_OVERLAYS: {
    SHOW_GEORGIA_LANES: true,    // Toggle Georgia intersection lanes
    SHOW_HOUSTON_LANES: true,    // Toggle Houston intersection lanes
    SHOW_LINDSAY_LANES: true,    // Toggle Lindsay intersection lanes
  }
} as const;