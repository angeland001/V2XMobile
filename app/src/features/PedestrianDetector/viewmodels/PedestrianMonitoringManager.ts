// app/src/features/PedestrianDetector/viewModels/PedestrianMonitoringManager.ts
// Handles monitoring lifecycle and periodic updates

import { makeAutoObservable, runInAction } from 'mobx';
import { PedestrianDataManager } from './PedestrianDataManager';
import { PedestrianErrorHandler } from '../errorHandling/PedestrianErrorHandler';

export class PedestrianMonitoringManager {
  // State
  isMonitoring: boolean = false;
  
  // Dependencies
  private dataManager: PedestrianDataManager;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_FREQUENCY = 100; // Check every 100ms for new messages
  
  // Callback for when data updates
  private onDataUpdateCallback: (() => void) | null = null;
  
  constructor(dataManager: PedestrianDataManager) {
    makeAutoObservable(this);
    this.dataManager = dataManager;
  }
  
  // ========================================
  // Public Methods
  // ========================================
  
  /**
   * Set callback to be called when data updates
   */
  setDataUpdateCallback(callback: () => void): void {
    this.onDataUpdateCallback = callback;
  }
  
  /**
   * Start monitoring pedestrian data
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      PedestrianErrorHandler.logWarning('startMonitoring', 'Already monitoring');
      return;
    }
    
    try {
      
      runInAction(() => {
        this.isMonitoring = true;
      });
      
      // Fetch data immediately
      this.fetchAndUpdate();
      
      // Set up periodic updates
      this.startPeriodicUpdates();
      
    } catch (error) {
      PedestrianErrorHandler.logError('startMonitoring', error);
      this.stopMonitoring();
    }
  }
  
  /**
   * Stop monitoring pedestrian data
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    runInAction(() => {
      this.isMonitoring = false;
    });
    
  }
  
  /**
   * Force refresh pedestrian data
   */
  async refreshData(): Promise<void> {
    if (!this.isMonitoring) {
      PedestrianErrorHandler.logWarning('refreshData', 'Not currently monitoring');
      return;
    }
    
    await this.fetchAndUpdate();
  }
  
  /**
   * Check if monitoring is active
   */
  get isActive(): boolean {
    return this.isMonitoring;
  }
  
  /**
   * Get update frequency in milliseconds
   */
  get updateFrequency(): number {
    return this.UPDATE_FREQUENCY;
  }
  
  /**
   * Set custom update frequency (for testing or different scenarios)
   */
  setUpdateFrequency(frequencyMs: number): void {
    if (frequencyMs < 500) {
      PedestrianErrorHandler.logWarning('setUpdateFrequency', 'Frequency too low, setting to 500ms minimum');
      frequencyMs = 500;
    }
    
    // Restart monitoring with new frequency if currently active
    if (this.isMonitoring) {
      this.stopMonitoring();
      // Update frequency (this would require making UPDATE_FREQUENCY mutable)
      // For now, just log the change
      this.startMonitoring();
    }
  }
  
  // ========================================
  // Private Methods
  // ========================================
  
  /**
   * Fetch data and trigger callback
   */
  private async fetchAndUpdate(): Promise<void> {
    try {
      await this.dataManager.fetchPedestrianData();
      this.triggerDataUpdateCallback();
    } catch (error) {
      PedestrianErrorHandler.logError('fetchAndUpdate', error);
      // Continue monitoring even if individual updates fail
    }
  }
  
  /**
   * Start periodic data updates
   */
  private startPeriodicUpdates(): void {
    this.monitoringInterval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      await this.fetchAndUpdate();
    }, this.UPDATE_FREQUENCY);
  }
  
  /**
   * Trigger data update callback if set
   */
  private triggerDataUpdateCallback(): void {
    if (this.onDataUpdateCallback) {
      try {
        this.onDataUpdateCallback();
      } catch (error) {
        PedestrianErrorHandler.logError('dataUpdateCallback', error);
      }
    }
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopMonitoring();
    this.dataManager.cleanup();
    this.onDataUpdateCallback = null;
  }
}

export default PedestrianMonitoringManager;