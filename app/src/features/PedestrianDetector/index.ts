// app/src/features/PedestrianDetector/index.ts
// Clean exports for the refactored PedestrianDetector feature

// ========================================
// Main ViewModel (Primary Interface)
// ========================================
export { PedestrianDetectorViewModel } from './viewmodels/PedestrianDetectorViewModel';

// ========================================
// Individual Managers (Advanced Use)
// ========================================
export { PedestrianDataManager } from './viewmodels/PedestrianDataManager';

// ========================================
// Services
// ========================================
export { CrosswalkDetectionService } from './services/CrosswalkDetectionService';
export { ProximityDetectionService } from './services/ProximityDetectionService';
export { PedestrianWarningService } from './services/PedestrianWarningService';

// ========================================
// Error Handling
// ========================================
export { PedestrianErrorHandler } from './errorHandling/PedestrianErrorHandler';

// ========================================
// Types and Interfaces
// ========================================
export type { PedestrianAlert } from './services/PedestrianWarningService';

// ========================================
// Re-export from related features for convenience
// ========================================
export { CROSSWALK_POLYGON_COORDS } from '../Crosswalk/constants/CrosswalkCoordinates';

import { PedestrianDetectorViewModel } from './viewmodels/PedestrianDetectorViewModel';
export default PedestrianDetectorViewModel;

