// app/src/features/Lanes/viewmodels/LanesViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { Lane, LegacyLane, LaneAdapter, LaneConfiguration, LaneStyle } from '../models/LaneTypes';
import { LaneRenderingService } from '../services/LaneRenderingService';
import { 
  LANE_CONFIG, 
  GEORGIA_INTERSECTION_LANES,
  HOUSTON_INTERSECTION_LANES,
  LINDSAY_INTERSECTION_LANES,
  getLanesForIntersection, 
  getLaneConfigForIntersection 
} from '../constants/LaneData';
import { TESTING_CONFIG } from '../../../testingFeatures/TestingConfig';

export class LanesViewModel {
  // Observable state - use new Lane format internally
  lanes: Lane[] = [];
  visible: boolean = true;
  error: string | null = null;

  // Intersection-specific visibility toggles (observable)
  showGeorgiaLanes: boolean = TESTING_CONFIG.LANE_OVERLAYS.SHOW_GEORGIA_LANES;
  showHoustonLanes: boolean = TESTING_CONFIG.LANE_OVERLAYS.SHOW_HOUSTON_LANES;
  showLindsayLanes: boolean = TESTING_CONFIG.LANE_OVERLAYS.SHOW_LINDSAY_LANES;

  constructor(initialConfig?: LaneConfiguration) {
    // Initialize with provided config or default config
    const config = initialConfig || LANE_CONFIG;
    this.lanes = [...config.lanes];
    this.visible = config.visible;

    makeAutoObservable(this);
  }

  /**
   * Get all visible lanes (converted to legacy format for rendering)
   * Filters based on intersection-specific toggles
   */
  get visibleLanes(): LegacyLane[] {
    if (!this.visible) {
      return [];
    }

    // Filter lanes based on intersection toggles
    const filteredLanes = this.lanes.filter(lane => {
      // Determine which intersection this lane belongs to
      if (this.isGeorgiaLane(lane.laneID)) {
        return this.showGeorgiaLanes;
      } else if (this.isHoustonLane(lane.laneID)) {
        return this.showHoustonLanes;
      } else if (this.isLindsayLane(lane.laneID)) {
        return this.showLindsayLanes;
      }
      return false;
    });

    const legacyLanes = LaneAdapter.toLegacyLanes(filteredLanes);
    return LaneRenderingService.getVisibleLanes(legacyLanes);
  }

  /**
   * Check if lane ID belongs to Georgia intersection
   */
  private isGeorgiaLane(laneId: number): boolean {
    return GEORGIA_INTERSECTION_LANES.some(lane => lane.laneID === laneId);
  }

  /**
   * Check if lane ID belongs to Houston intersection
   */
  private isHoustonLane(laneId: number): boolean {
    return HOUSTON_INTERSECTION_LANES.some(lane => lane.laneID === laneId);
  }

  /**
   * Check if lane ID belongs to Lindsay intersection
   */
  private isLindsayLane(laneId: number): boolean {
    return LINDSAY_INTERSECTION_LANES.some(lane => lane.laneID === laneId);
  }

  /**
   * Toggle Georgia lanes visibility
   */
  toggleGeorgiaLanes(): void {
    runInAction(() => {
      this.showGeorgiaLanes = !this.showGeorgiaLanes;
    });
  }

  /**
   * Toggle Houston lanes visibility
   */
  toggleHoustonLanes(): void {
    runInAction(() => {
      this.showHoustonLanes = !this.showHoustonLanes;
    });
  }

  /**
   * Toggle Lindsay lanes visibility
   */
  toggleLindsayLanes(): void {
    runInAction(() => {
      this.showLindsayLanes = !this.showLindsayLanes;
    });
  }

  /**
   * Set Georgia lanes visibility
   */
  setGeorgiaLanesVisibility(visible: boolean): void {
    runInAction(() => {
      this.showGeorgiaLanes = visible;
    });
  }

  /**
   * Set Houston lanes visibility
   */
  setHoustonLanesVisibility(visible: boolean): void {
    runInAction(() => {
      this.showHoustonLanes = visible;
    });
  }

  /**
   * Set Lindsay lanes visibility
   */
  setLindsayLanesVisibility(visible: boolean): void {
    runInAction(() => {
      this.showLindsayLanes = visible;
    });
  }

  /**
   * Show all intersection lanes
   */
  showAllIntersections(): void {
    runInAction(() => {
      this.showGeorgiaLanes = true;
      this.showHoustonLanes = true;
      this.showLindsayLanes = true;
    });
  }

  /**
   * Hide all intersection lanes
   */
  hideAllIntersections(): void {
    runInAction(() => {
      this.showGeorgiaLanes = false;
      this.showHoustonLanes = false;
      this.showLindsayLanes = false;
    });
  }

  /**
   * Get lane by ID (returns legacy format)
   */
  getLane(laneId: string): LegacyLane | undefined {
    const legacyLanes = LaneAdapter.toLegacyLanes(this.lanes);
    return LaneRenderingService.getLaneById(legacyLanes, laneId);
  }

  /**
   * Toggle visibility of all lanes
   */
  toggleGlobalVisibility(): void {
    this.visible = !this.visible;
  }

  /**
   * Set global visibility
   */
  setGlobalVisibility(visible: boolean): void {
    this.visible = visible;
  }

  /**
   * Toggle visibility of a specific lane
   */
  toggleLaneVisibility(laneId: string): void {
    console.warn('Lane visibility toggle not implemented for new Lane format');
  }

  /**
   * Set visibility of a specific lane
   */
  setLaneVisibility(laneId: string, visible: boolean): void {
    console.warn('Lane visibility setting not implemented for new Lane format');
  }

  /**
   * Update lane style
   */
  updateLaneStyle(laneId: string, styleUpdate: Partial<LaneStyle>): void {
    console.warn('Lane style updates not implemented for new Lane format');
  }

  /**
   * Add a new lane
   */
  addLane(lane: Lane): void {
    // Validate coordinates before adding
    if (!LaneRenderingService.validateLaneCoordinates(lane.geometry.coordinates)) {
      this.error = `Invalid coordinates for lane ${lane.laneID}`;
      return;
    }

    // Check if lane ID already exists
    if (this.lanes.find(l => l.laneID === lane.laneID)) {
      this.error = `Lane with ID ${lane.laneID} already exists`;
      return;
    }

    this.lanes.push(lane);
    this.error = null;
  }

  /**
   * Remove a lane
   */
  removeLane(laneId: string): void {
    const numericLaneId = parseInt(laneId.replace('lane-', ''));
    this.lanes = this.lanes.filter(lane => lane.laneID !== numericLaneId);
  }

  /**
   * Update lane coordinates
   */
  updateLaneCoordinates(laneId: string, coordinates: [number, number][]): void {
    if (!LaneRenderingService.validateLaneCoordinates(coordinates)) {
      this.error = `Invalid coordinates for lane ${laneId}`;
      return;
    }

    const numericLaneId = parseInt(laneId.replace('lane-', ''));
    this.lanes = this.lanes.map(lane =>
      lane.laneID === numericLaneId
        ? { ...lane, geometry: { ...lane.geometry, coordinates } }
        : lane
    );
    this.error = null;
  }

  /**
   * Reset to default configuration
   */
  resetToDefault(): void {
    this.lanes = [...LANE_CONFIG.lanes];
    this.visible = LANE_CONFIG.visible;
    this.error = null;
    
    // Reset intersection toggles to config defaults
    runInAction(() => {
      this.showGeorgiaLanes = TESTING_CONFIG.LANE_OVERLAYS.SHOW_GEORGIA_LANES;
      this.showHoustonLanes = TESTING_CONFIG.LANE_OVERLAYS.SHOW_HOUSTON_LANES;
      this.showLindsayLanes = TESTING_CONFIG.LANE_OVERLAYS.SHOW_LINDSAY_LANES;
    });
  }

  /**
   * Get current configuration
   */
  getCurrentConfiguration(): LaneConfiguration {
    return {
      lanes: [...this.lanes],
      defaultStyle: LANE_CONFIG.defaultStyle,
      visible: this.visible
    };
  }

  /**
   * Clear any errors
   */
  clearError(): void {
    this.error = null;
  }

  /**
   * Get lanes count
   */
  get lanesCount(): number {
    return this.lanes.length;
  }

  /**
   * Get visible lanes count
   */
  get visibleLanesCount(): number {
    return this.visibleLanes.length;
  }

  /**
   * Get visible lanes count by intersection
   */
  get georgiaLanesCount(): number {
    if (!this.showGeorgiaLanes) return 0;
    return this.lanes.filter(lane => this.isGeorgiaLane(lane.laneID)).length;
  }

  get houstonLanesCount(): number {
    if (!this.showHoustonLanes) return 0;
    return this.lanes.filter(lane => this.isHoustonLane(lane.laneID)).length;
  }

  get lindsayLanesCount(): number {
    if (!this.showLindsayLanes) return 0;
    return this.lanes.filter(lane => this.isLindsayLane(lane.laneID)).length;
  }

  /**
   * Check if any lanes are visible
   */
  get hasVisibleLanes(): boolean {
    return this.visible && this.visibleLanes.length > 0;
  }

  /**
   * Get lanes for a specific intersection
   */
  getLanesForIntersection(intersection: 'georgia' | 'houston' | 'lindsay' | 'all'): Lane[] {
    const intersectionLanes = getLanesForIntersection(intersection);
    return intersectionLanes.filter(lane =>
      this.lanes.some(myLane => myLane.laneID === lane.laneID)
    );
  }

  /**
   * Get visible lanes for a specific intersection
   */
  getVisibleLanesForIntersection(intersection: 'georgia' | 'houston' | 'lindsay' | 'all'): LegacyLane[] {
    if (!this.visible) {
      return [];
    }
    
    // Check intersection-specific visibility
    if (intersection === 'georgia' && !this.showGeorgiaLanes) return [];
    if (intersection === 'houston' && !this.showHoustonLanes) return [];
    if (intersection === 'lindsay' && !this.showLindsayLanes) return [];
    
    const intersectionLanes = this.getLanesForIntersection(intersection);
    const legacyLanes = LaneAdapter.toLegacyLanes(intersectionLanes);
    return LaneRenderingService.getVisibleLanes(legacyLanes);
  }

  /**
   * Load lanes for a specific intersection
   */
  loadIntersectionLanes(intersection: 'georgia' | 'houston' | 'lindsay' | 'all'): void {
    const config = getLaneConfigForIntersection(intersection);
    this.lanes = [...config.lanes];
    this.visible = config.visible;
    this.error = null;
  }

  /**
   * Add lanes from a specific intersection to current lanes
   */
  addIntersectionLanes(intersection: 'georgia' | 'houston' | 'lindsay'): void {
    const intersectionLanes = getLanesForIntersection(intersection);

    for (const lane of intersectionLanes) {
      if (!this.lanes.find(l => l.laneID === lane.laneID)) {
        this.lanes.push(lane);
      }
    }
    this.error = null;
  }
}

export default LanesViewModel;