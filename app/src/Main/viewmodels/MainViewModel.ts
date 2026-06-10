// app/src/Main/viewmodels/MainViewModel.ts

import { makeAutoObservable } from 'mobx';
import { Coordinate } from '../../features/Map/models/Location';
import { MapViewModel } from '../../features/Map/viewmodels/MapViewModel';
import { PedestrianDetectorViewModel } from '../../features/PedestrianDetector/viewmodels/PedestrianDetectorViewModel';
import { TestingPedestrianDetectorViewModel } from '../../testingFeatures/testingPedestrianDetectorFeatureTest/viewmodels/TestingPedestrianDetectorViewModel';
import { DirectionGuideViewModel } from '../../features/DirectionGuide/viewModels/DirectionGuideViewModel';
import { TESTING_CONFIG } from '../../testingFeatures/TestingConfig';
import { VehicleDisplayViewModel } from '../../features/SDSM/viewmodels/VehicleDisplayViewModel';
import { LanesViewModel } from '../../features/Lanes';
import { SpatViewModel } from '../../features/SpatService/viewModels/SpatViewModel';
import { SpatZoneService } from '../../features/SpatService/services/SpatZoneService';

export class MainViewModel {
  mapViewModel: MapViewModel;
  pedestrianDetectorViewModel: PedestrianDetectorViewModel | null = null;
  testingPedestrianDetectorViewModel: TestingPedestrianDetectorViewModel | null = null;
  directionGuideViewModel: DirectionGuideViewModel;
  vehicleDisplayViewModel: VehicleDisplayViewModel;
  lanesViewModel: LanesViewModel;
  spatViewModel: SpatViewModel;
  private positionSyncInterval: NodeJS.Timeout | null = null;
  
  isTestingMode: boolean = TESTING_CONFIG.USE_TESTING_MODE;
  
  constructor() {
    this.mapViewModel = new MapViewModel();
    this.vehicleDisplayViewModel = new VehicleDisplayViewModel();
    this.lanesViewModel = new LanesViewModel();
    this.spatViewModel = new SpatViewModel();
    
    if (TESTING_CONFIG.USE_TESTING_MODE) {
      this.testingPedestrianDetectorViewModel = new TestingPedestrianDetectorViewModel();
    } else {
      this.pedestrianDetectorViewModel = new PedestrianDetectorViewModel();
    }

    if (TESTING_CONFIG.SHOW_FIXED_PEDESTRIAN && !this.testingPedestrianDetectorViewModel) {
      this.testingPedestrianDetectorViewModel = new TestingPedestrianDetectorViewModel();
    }
    
    this.directionGuideViewModel = new DirectionGuideViewModel();
    makeAutoObservable(this);
    
    this.startApisOnLaunch();
    this.startPedestrianMonitoring();
    this.startSpatMonitoring();


  }
  
  /**
   * 🚀 Start SDSM Object Tracking
   * Automatically tracks all objects from CV2X API for 60 seconds
   * and generates a CSV log at the end
   */
 
  
  private startApisOnLaunch(): void {
    if (TESTING_CONFIG.ENABLE_SDSM_API) {
      this.vehicleDisplayViewModel.setApiUrl('georgia');
      this.vehicleDisplayViewModel.start();
    }
  }
  
  private startPedestrianMonitoring(): void {
    try {
      if (this.isTestingMode && this.testingPedestrianDetectorViewModel) {
        this.testingPedestrianDetectorViewModel.startMonitoring();
      } else if (!this.isTestingMode && this.pedestrianDetectorViewModel) {
        this.pedestrianDetectorViewModel.startMonitoring();
      }
    } catch (error) {
      // Silent
    }
  }

  private startSpatMonitoring(): void {
    // First-step integration: load SPaT zones from dashboard/backend API.
    // Runtime still falls back to local constants if API is unreachable.
    SpatZoneService.loadZonesFromDashboard(1);

    const startWhenReady = () => {
      if (this.userLocation.latitude !== 0 && this.userLocation.longitude !== 0) {
        this.spatViewModel.setUserPosition([
          this.userLocation.latitude, 
          this.userLocation.longitude
        ]);
        
        this.spatViewModel.startMonitoring();

        this.positionSyncInterval = setInterval(() => {
          if (this.userLocation.latitude !== 0 && this.userLocation.longitude !== 0) {
            this.spatViewModel.setUserPosition([
              this.userLocation.latitude,
              this.userLocation.longitude
            ]);
          }
        }, 500);
      } else {
        setTimeout(startWhenReady, 1000);
      }
    };

    startWhenReady();
  }
  
  get activePedestrianDetector(): PedestrianDetectorViewModel | TestingPedestrianDetectorViewModel | null {
    return this.isTestingMode ? this.testingPedestrianDetectorViewModel : this.pedestrianDetectorViewModel;
  }
  
  get isInitialized(): boolean {
    return this.mapViewModel.isInitialized || false;
  }
  
  get loading(): boolean {
    return this.mapViewModel.loading;
  }
  
  get userLocation(): Coordinate {
    return this.mapViewModel.userLocation;
  }
  
  get userLocationCoordinate(): [number, number] {
    return this.mapViewModel.userLocationCoordinate;
  }
  
  async refreshLocation() {
    try {
      await this.mapViewModel.getCurrentLocation();
      return this.mapViewModel.userLocation;
    } catch (error) {
      return null;
    }
  }
  
  hasPedestriansCrossing(): boolean {
    const activeDetector = this.activePedestrianDetector;
    return activeDetector ? activeDetector.pedestriansInCrosswalk > 0 : false;
  }
  
  getPedestriansCrossingCount(): number {
    const activeDetector = this.activePedestrianDetector;
    return activeDetector ? activeDetector.pedestriansInCrosswalk : 0;
  }
  
  get pedestriansInCrosswalk(): number {
    return this.getPedestriansCrossingCount();
  }
  
  async checkForPedestrians(): Promise<number> {
    const activeDetector = this.activePedestrianDetector;
    if (!activeDetector) return 0;
    
    if ('isMonitoring' in activeDetector && activeDetector.isMonitoring) {
      activeDetector.stopMonitoring();
    }
    if ('startMonitoring' in activeDetector) {
      activeDetector.startMonitoring();
    }
    
    return activeDetector.pedestriansInCrosswalk;
  }
  
  cleanup() {
    if (this.positionSyncInterval) {
      clearInterval(this.positionSyncInterval);
      this.positionSyncInterval = null;
    }

    try {
      this.vehicleDisplayViewModel?.cleanup();
    } catch (error) {
      // Silent
    }

    this.spatViewModel.cleanup();
    
    if (this.isTestingMode && this.testingPedestrianDetectorViewModel) {
      this.testingPedestrianDetectorViewModel.cleanup();
    } else if (!this.isTestingMode && this.pedestrianDetectorViewModel) {
      this.pedestrianDetectorViewModel.cleanup();
    }
    
    if (this.mapViewModel && this.mapViewModel.cleanup) {
      this.mapViewModel.cleanup();
    }
  }
}