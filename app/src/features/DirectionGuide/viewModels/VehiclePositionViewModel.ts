// app/src/features/DirectionGuide/viewModels/VehiclePositionViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';

/**
 * ViewModel responsible for vehicle position tracking and management
 * Handles position updates and validation
 */
export class VehiclePositionViewModel {
  // State
  private _currentPosition: [number, number] = [0, 0];
  private _previousPosition: [number, number] = [0, 0];
  private _lastUpdateTime: number = 0;
  private _isValidPosition: boolean = false;
  
  // Position change callbacks
  private positionChangeCallbacks: Array<(position: [number, number]) => void> = [];
  
  constructor() {
    makeAutoObservable(this);
  }
  
  // ========================================
  // Public Getters
  // ========================================
  
  get currentPosition(): [number, number] {
    return this._currentPosition;
  }
  
  get previousPosition(): [number, number] {
    return this._previousPosition;
  }
  
  get lastUpdateTime(): number {
    return this._lastUpdateTime;
  }
  
  get isValidPosition(): boolean {
    return this._isValidPosition;
  }
  
  get hasPositionChanged(): boolean {
    return !this.positionsEqual(this._currentPosition, this._previousPosition);
  }
  
  get timeSinceLastUpdate(): number {
    return this._lastUpdateTime > 0 ? Date.now() - this._lastUpdateTime : -1;
  }
  
  // ========================================
  // Public Methods
  // ========================================
  
  /**
   * Update vehicle position
   */
  setPosition(position: [number, number]): void {
    const isValid = this.validatePosition(position);
    
    runInAction(() => {
      this._previousPosition = [...this._currentPosition];
      this._currentPosition = [...position];
      this._lastUpdateTime = Date.now();
      this._isValidPosition = isValid;
    });
    
    // Log position updates periodically (every 10th update to avoid spam)
    if (this._lastUpdateTime % 10 === 1) {
    }
    
    // Only propagate if the vehicle actually moved ≥5 m (filters GPS noise)
    if (isValid && this.isMoving(5)) {
      this.notifyPositionChange(position);
    }
  }
  
  /**
   * Subscribe to position changes
   */
  onPositionChange(callback: (position: [number, number]) => void): () => void {
    this.positionChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.positionChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.positionChangeCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Get distance moved from previous position
   */
  getDistanceMoved(): number {
    if (!this.hasPositionChanged) {
      return 0;
    }
    
    return this.calculateDistance(this._previousPosition, this._currentPosition);
  }
  
  /**
   * Get movement direction in degrees
   */
  getMovementDirection(): number | null {
    if (!this.hasPositionChanged) {
      return null;
    }
    
    const [prevLat, prevLng] = this._previousPosition;
    const [currLat, currLng] = this._currentPosition;
    
    const deltaLat = currLat - prevLat;
    const deltaLng = currLng - prevLng;
    
    const bearing = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
  }
  
  /**
   * Check if vehicle is moving (threshold in metres)
   */
  isMoving(threshold: number = 5): boolean {
    return this.getDistanceMoved() > threshold;
  }
  
  /**
   * Reset position tracking
   */
  reset(): void {
    runInAction(() => {
      this._currentPosition = [0, 0];
      this._previousPosition = [0, 0];
      this._lastUpdateTime = 0;
      this._isValidPosition = false;
    });
    
    // Clear callbacks
    this.positionChangeCallbacks = [];
  }
  
  /**
   * Get position as string for logging
   */
  getPositionString(): string {
    if (!this._isValidPosition) {
      return 'Invalid Position';
    }
    
    return `[${this._currentPosition[0].toFixed(6)}, ${this._currentPosition[1].toFixed(6)}]`;
  }
  
  // ========================================
  // Private Methods
  // ========================================
  
  /**
   * Validate if position is reasonable
   */
  private validatePosition(position: [number, number]): boolean {
    const [lat, lng] = position;
    
    // Check for zero coordinates
    if (lat === 0 && lng === 0) {
      return false;
    }
    
    // Check for reasonable coordinate ranges
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return false;
    }
    
    // Check for NaN or undefined
    if (isNaN(lat) || isNaN(lng)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if two positions are equal
   */
  private positionsEqual(pos1: [number, number], pos2: [number, number]): boolean {
    return pos1[0] === pos2[0] && pos1[1] === pos2[1];
  }
  
  /**
   * Haversine distance between two [lat, lng] positions, returns metres.
   */
  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371000;
    const [lat1, lng1] = pos1;
    const [lat2, lng2] = pos2;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  
  /**
   * Notify all callbacks of position change
   */
  private notifyPositionChange(position: [number, number]): void {
    this.positionChangeCallbacks.forEach(callback => {
      try {
        callback(position);
      } catch (error) {
      }
    });
  }
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.reset();
  }
}

export default VehiclePositionViewModel;