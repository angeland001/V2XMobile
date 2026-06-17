// app/src/features/DirectionGuide/viewModels/DirectionGuideViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { LaneDetectionViewModel } from './LaneDetectionViewModel';
import { VehiclePositionViewModel } from './VehiclePositionViewModel';
import { TurnDataManager } from './TurnDataManager';
import { PositionChangeHandler } from './PositionChangeHandler';
import { AllowedTurn } from '../models/DirectionTypes';

/**
 * Main DirectionGuide ViewModel - Pure orchestration and state exposure
 * Single responsibility: Coordinate managers and expose clean API
 */
export class DirectionGuideViewModel {
  // Simple state
  loading: boolean = false;
  error: string | null = null;
  showTurnGuide: boolean = false;

  // Specialized managers
  private laneDetectionViewModel!: LaneDetectionViewModel;
  private vehiclePositionViewModel!: VehiclePositionViewModel;
  private turnDataManager!: TurnDataManager;
  private positionChangeHandler!: PositionChangeHandler;

  // Subscription cleanup
  private unsubscribePosition: (() => void) | null = null;

  constructor() {
    makeAutoObservable(this);

    // Initialize managers
    this.initializeManagers();

    // Setup coordination
    this.setupPositionTracking();

    // Initialize
    this.initialize();
  }

  // ========================================
  // Public API - Vehicle Position
  // ========================================

  get vehiclePosition(): [number, number] {
    return this.vehiclePositionViewModel.currentPosition;
  }

  setVehiclePosition(position: [number, number]): void {
    this.vehiclePositionViewModel.setPosition(position);
  }

  // ========================================
  // Public API - Lane Information
  // ========================================

  get detectedLaneIds(): number[] {
    return this.laneDetectionViewModel.detectedLaneIds;
  }

  get currentApproachName(): string {
    return this.laneDetectionViewModel.currentApproachName;
  }

  get currentLanes(): string {
    return this.laneDetectionViewModel.currentLanes;
  }

  isInLane(laneId: number): boolean {
    return this.positionChangeHandler.isInLane(laneId);
  }

  // ========================================
  // Public API - Turn Information
  // ========================================


  get allowedTurns(): AllowedTurn[] {
    return this.turnDataManager.allowedTurns;
  }

  get turnsAvailable(): number {
    return this.turnDataManager.turnsAvailable;
  }

  get currentIntersectionName(): string {
    return this.turnDataManager.intersectionName;
  }

  isTurnAllowed(turnType: string): boolean {
    return this.turnDataManager.isTurnAllowed(turnType);
  }


  // ========================================
  // Public API - Actions
  // ========================================

  /**
   * Force refresh all data
   */
  async refreshAllData(): Promise<void> {
    try {
      runInAction(() => {
        this.loading = true;
        this.error = null;
      });

      await this.laneDetectionViewModel.refreshData();

      // Trigger re-detection with current position
      if (this.vehiclePositionViewModel.isValidPosition) {
        const shouldShow = await this.positionChangeHandler.handlePositionChange(
          this.vehiclePositionViewModel.currentPosition
        );

        runInAction(() => {
          this.showTurnGuide = shouldShow;
        });
      }

      runInAction(() => {
        this.loading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Refresh failed';
        this.loading = false;
      });
    }
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    // Unsubscribe from position changes
    if (this.unsubscribePosition) {
      this.unsubscribePosition();
      this.unsubscribePosition = null;
    }

    // Cleanup all managers
    this.laneDetectionViewModel.cleanup();
    this.vehiclePositionViewModel.cleanup();
    this.turnDataManager.cleanup();
    this.positionChangeHandler.cleanup();

    runInAction(() => {
      this.showTurnGuide = false;
      this.loading = false;
      this.error = null;
    });
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * Initialize all managers
   */
  private initializeManagers(): void {
    this.laneDetectionViewModel = new LaneDetectionViewModel();
    this.vehiclePositionViewModel = new VehiclePositionViewModel();
    this.turnDataManager = new TurnDataManager();

    // Position change handler coordinates the other managers
    this.positionChangeHandler = new PositionChangeHandler(
      this.laneDetectionViewModel,
      this.turnDataManager
    );
  }

  /**
   * Setup position tracking coordination
   */
  private setupPositionTracking(): void {
    this.unsubscribePosition = this.vehiclePositionViewModel.onPositionChange(
      async (position) => {
        const shouldShowGuide = await this.positionChangeHandler.handlePositionChange(position);

        runInAction(() => {
          this.showTurnGuide = shouldShowGuide;
        });
      }
    );
  }

  /**
   * Initialize the ViewModel
   */
  private async initialize(): Promise<void> {
    try {
      runInAction(() => {
        this.loading = true;
        this.error = null;
      });

      // Initialize lane detection (loads cached data)
      await this.laneDetectionViewModel.initialize();

      runInAction(() => {
        this.loading = false;
      });

    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Init failed';
        this.loading = false;
      });
    }
  }
}

export default DirectionGuideViewModel;
