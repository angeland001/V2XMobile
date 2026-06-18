// app/src/features/SDSM/index.ts
// Clean exports for the SDSM vehicle display feature

import { SDSMService } from './services/SDSMService';
import { VehicleDisplayViewModel } from './viewmodels/VehicleDisplayViewModel';

// ========================================
// Main ViewModel (Primary Interface)
// ========================================
export type { VehicleData, VRUData } from './models/SDSMTypes';
export { VehicleDisplayViewModel } from './viewmodels/VehicleDisplayViewModel';

// ========================================
// UI Components
// ========================================
export { VehicleMarkers } from './views/VehicleMarkers';
export { VRUMarkers } from './views/VRUMarkers';

// ========================================
// Services
// ========================================
export { SDSMService } from './services/SDSMService';

// ========================================
// Models and Types
// ========================================

// ========================================
// Configuration
// ========================================
export const SDSM_CONFIG = {
  FEATURE_NAME: 'SDSM Vehicle Display',
  VERSION: '1.0.0',
  UPDATE_FREQUENCY_HZ: 0.66,
  API_ENDPOINT: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia',
  REQUEST_TIMEOUT_MS: 1000,
  DESCRIPTION: 'Real-time vehicle display from SDSM data at 10Hz'
};

// ========================================
// Quick Setup Function
// ========================================

/**
 * Quick setup function to initialize SDSM vehicle display
 * @returns Configured VehicleDisplayViewModel ready to use
 */
export const createVehicleDisplay = (): VehicleDisplayViewModel => {
  // Removed initialization logs to reduce noise
  
  const viewModel = new VehicleDisplayViewModel();
  return viewModel;
};

/**
 * Test SDSM connection and log results
 */
export const testSDSMConnection = async (): Promise<boolean> => {
  // Removed connection test logs to reduce noise

  try {
    const isConnected = await SDSMService.testConnection();

    // Removed connection result logs to reduce noise

    return isConnected;
  } catch (error) {
    // Removed connection error logs to reduce noise
    return false;
  }
};

export default VehicleDisplayViewModel;
