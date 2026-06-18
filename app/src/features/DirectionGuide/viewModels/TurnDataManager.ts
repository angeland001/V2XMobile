// app/src/features/DirectionGuide/viewModels/TurnDataManager.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { MapDataService } from '../services/MapDataService';
import { ProcessedIntersectionData } from '../models/IntersectionData';

/**
 * Manages turn data loading and processing
 * Single responsibility: Handle turn data operations
 */
export class TurnDataManager {
  // State
  intersectionData: ProcessedIntersectionData | null = null;
  loading: boolean = false;
  error: string | null = null;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  // ========================================
  // Public Methods
  // ========================================
  
  /**
   * Load turn data for given lanes and position
   */
  async loadTurnData(lanesData: any[], vehiclePosition: [number, number]): Promise<void> {
    if (lanesData.length === 0) {
      this.clearTurnData();
      return;
    }
    
    try {
      runInAction(() => {
        this.loading = true;
        this.error = null;
      });
      
      // Process the data to get turn information
      const processedData = MapDataService.processCarPositionData(
        { 
          intersectionId: 27482, // MLK intersection
          intersectionName: 'MLK - Central Ave',
          timestamp: new Date().toISOString(),
          lanes: lanesData
        },
        vehiclePosition
      );
      
      runInAction(() => {
        this.intersectionData = processedData;
        this.loading = false;
        this.error = null;
      });
      
      
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Load failed';
        this.intersectionData = null;
        this.loading = false;
      });
    }
  }
  
  /**
   * Clear turn data
   */
  clearTurnData(): void {
    runInAction(() => {
      this.intersectionData = null;
      this.error = null;
      this.loading = false;
    });
  }
  
  /**
   * Get allowed turns
   */
  get allowedTurns() {
    return this.intersectionData?.allAllowedTurns || [];
  }
  
  /**
   * Get number of available turns
   */
  get turnsAvailable(): number {
    return this.allowedTurns.filter(t => t.allowed).length;
  }
  
  /**
   * Get intersection name
   */
  get intersectionName(): string {
    return this.intersectionData?.intersectionName || 'Unknown';
  }
  
  /**
   * Check if specific turn is allowed
   */
  isTurnAllowed(turnType: string): boolean {
    const turn = this.allowedTurns.find(t => t.type === turnType);
    return turn?.allowed || false;
  }
  
  /**
   * Check if we have valid turn data
   */
  get hasTurnData(): boolean {
    return this.intersectionData !== null && !this.loading;
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearTurnData();
  }
}

export default TurnDataManager;