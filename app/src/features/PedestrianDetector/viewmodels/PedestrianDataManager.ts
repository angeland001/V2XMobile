// app/src/features/PedestrianDetector/viewModels/PedestrianDataManager.ts
// Handles pedestrian data management (receives data from SDSM feature)

import { makeAutoObservable, runInAction } from 'mobx';
import { VRUData } from '../../SDSM/models/SDSMTypes';

// Use VRUData from SDSM feature for consistency
export type PedestrianData = VRUData;

export class PedestrianDataManager {
  // State
  pedestrians: PedestrianData[] = [];
  error: string | null = null;
  private _lastUpdateTime: number = 0;

  // State preservation
  private pedestrianMap: Map<number, PedestrianData> = new Map();

  constructor() {
    makeAutoObservable(this);
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Update pedestrian data from SDSM feature
   */
  updatePedestrianData(vruData: VRUData[]): void {
    try {
      runInAction(() => {
        this.error = null;
      });

      this.updatePedestrianState(vruData);

    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to update pedestrian data';
      });
    }
  }

  /**
   * Update pedestrian state with new VRU data from SDSM
   */
  private updatePedestrianState(vruData: VRUData[]): void {
    // Track new pedestrians and update pedestrian map
    const currentTime = Date.now();
    vruData.forEach(pedestrian => {
      this.pedestrianMap.set(pedestrian.id, pedestrian);
    });

    // Remove old pedestrians that are no longer present
    const currentIds = new Set(vruData.map(p => p.id));
    for (const [id] of this.pedestrianMap) {
      if (!currentIds.has(id)) {
        this.pedestrianMap.delete(id);
      }
    }

    runInAction(() => {
      this.pedestrians = Array.from(this.pedestrianMap.values());
      this._lastUpdateTime = currentTime;
    });
  }

  /**
   * Get pedestrian count
   */
  get pedestrianCount(): number {
    return this.pedestrians.length;
  }

  /**
   * Check if data is fresh (updated within last 5 seconds)
   */
  isDataFresh(): boolean {
    const maxAge = 5000; // 5 seconds
    const dataAge = this.getDataAge();
    return dataAge >= 0 && dataAge <= maxAge;
  }

  /**
   * Get data age in milliseconds
   */
  getDataAge(): number {
    return this._lastUpdateTime > 0 ? Date.now() - this._lastUpdateTime : -1;
  }

  /**
   * Clear pedestrian data
   */
  clearData(): void {
    runInAction(() => {
      this.pedestrians = [];
      this.pedestrianMap.clear();
      this.error = null;
      this._lastUpdateTime = 0;
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearData();
  }
}

export default PedestrianDataManager;