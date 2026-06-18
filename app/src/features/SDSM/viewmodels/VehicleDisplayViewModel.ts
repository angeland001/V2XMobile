// app/src/features/SDSM/viewmodels/VehicleDisplayViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { VehicleData, VRUData } from '../models/SDSMTypes';
import { SDSMDataService } from '../services/SDSMDataService';
import { TESTING_CONFIG } from '../../../testingFeatures/TestingConfig';

interface VehicleWithHistory extends VehicleData {
  positionHistory: Array<{
    coordinates: [number, number];
    timestamp: number;
    heading?: number;
  }>;
  firstSeenTime: number;
  lastUpdateTime: number;
  lastApiUpdateTime: number;
  isStable: boolean;
  isStale: boolean;
  confidenceLevel: number;
}

interface VRUWithHistory extends VRUData {
  positionHistory: Array<{
    coordinates: [number, number];
    timestamp: number;
    heading?: number;
  }>;
  firstSeenTime: number;
  lastUpdateTime: number;
  lastApiUpdateTime: number;
  isStable: boolean;
  isStale: boolean;
  confidenceLevel: number;
}

export class VehicleDisplayViewModel {
  // Observable state
  vehicles: VehicleData[] = [];
  vrus: VRUData[] = [];
  isActive: boolean = false;
  lastUpdateTime: number = 0;
  updateCount: number = 0;
  error: string | null = null;
  
  // Connection health tracking
  consecutiveFailures: number = 0;
  lastSuccessfulFetch: number = 0;
  isConnectionHealthy: boolean = true;
  
  // Statistics
  totalMessages: number = 0;
  newMessages: number = 0;
  duplicateMessages: number = 0;
  
  // Configuration - Georgia only
  private API_URL = 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia';
  private readonly POLL_DELAY_MS = 500; // 2Hz
  private readonly FETCH_TIMEOUT_MS = 8000;
  
  // Stability settings
  private readonly MIN_HISTORY_COUNT = 2;
  private readonly MIN_STABLE_TIME_MS = 300;
  private readonly MAX_HISTORY_COUNT = 8;
  private readonly POSITION_CHANGE_THRESHOLD = 0.00001;
  
  // Graceful degradation settings
  private readonly STALE_WARNING_TIME_MS = 3000;
  private readonly STALE_REMOVAL_TIME_MS = 8000;
  private readonly CONFIDENCE_DECAY_RATE = 0.1;
  private readonly MIN_CONFIDENCE_TO_SHOW = 0.3;
  
  // Network resilience
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly CONNECTION_RECOVERY_DELAY_MS = 1000;
  
  // Internal tracking with history
  private vehicleHistory: Map<number, VehicleWithHistory> = new Map();
  private vruHistory: Map<number, VRUWithHistory> = new Map();
  
  // State tracking
  private lastMessageHash: string | null = null;
  private isPolling: boolean = false;
  private activeController: AbortController | null = null;
  
  constructor() {
    makeAutoObservable(this);
  }
  
  /**
   * Set the API URL - only Georgia is supported
   */
  setApiUrl(intersection: 'georgia'): void {
    this.API_URL = 'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia';
    
    // Clear existing vehicle history when changing API
    this.vehicleHistory.clear();
    this.vruHistory.clear();
    
    runInAction(() => {
      this.vehicles = [];
      this.vrus = [];
      this.lastMessageHash = null;
    });
  }

  /**
   * Start the polling loop
   */
  start(): void {
    console.log('[SDSM] start() called, ENABLE_SDSM_API=', TESTING_CONFIG.ENABLE_SDSM_API, 'isActive=', this.isActive);
    if (!TESTING_CONFIG.ENABLE_SDSM_API) {
      runInAction(() => {
        this.vehicles = [];
        this.vrus = [];
        this.isActive = false;
      });
      return;
    }

    if (this.isActive) {
      return;
    }

    runInAction(() => {
      this.isActive = true;
      this.error = null;
      this.consecutiveFailures = 0;
      this.lastSuccessfulFetch = Date.now();
      this.isConnectionHealthy = true;
    });

    this.runPollingLoop();
  }
  
  /**
   * Main polling loop with connection health monitoring
   */
  private async runPollingLoop(): Promise<void> {
    this.isPolling = true;

    while (this.isActive && this.isPolling) {
      try {
        const data = await this.fetchFromRSU();

        if (data) {
          // Successful fetch - reset failure count
          this.consecutiveFailures = 0;
          this.lastSuccessfulFetch = Date.now();
          this.isConnectionHealthy = true;

          this.totalMessages++;
          const messageHash = this.createHash(data);

          if (messageHash !== this.lastMessageHash) {
            // Process new message with history tracking
            this.updateVehiclesWithHistory(data);
            this.lastMessageHash = messageHash;
            this.newMessages++;
          } else {
            // Same data, but keep objects alive so they don't go stale
            this.refreshLastApiUpdateTime(data);
            this.duplicateMessages++;
          }
        } else {
          // Failed fetch - increment failure count
          this.consecutiveFailures++;
          console.warn(`[SDSM] fetch returned null (failure #${this.consecutiveFailures})`);
          if (!__DEV__ && (this.consecutiveFailures === 1 || this.consecutiveFailures % 10 === 0)) {
            console.warn(`[SDSM] Fetch failed (${this.consecutiveFailures} consecutive failures)`);
          }
          if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
            this.isConnectionHealthy = false;
          }
        }

        // Always update state
        this.updateObjectsConfidence();
        this.updateObservableState();

      } catch (error) {
        this.consecutiveFailures++;

        if (error instanceof Error) {
          console.error('[SDSM] Poll error:', error.message);
          runInAction(() => {
            this.error = error.message;
          });
        }
      }
      
      // Adaptive delay based on connection health
      const delay = this.isConnectionHealthy ? 
        this.POLL_DELAY_MS : 
        this.CONNECTION_RECOVERY_DELAY_MS;
        
      await this.sleep(delay);
    }
    
    this.isPolling = false;
  }
  
  /**
   * On a duplicate response, refresh the API timestamp for objects still present
   * so they don't go stale while the intersection is just quiet (no position changes).
   */
  private refreshLastApiUpdateTime(data: any): void {
    const now = Date.now();
    const presentIds = new Set<number>(
      (data.objects ?? []).map((obj: any) => obj.objectID as number)
    );
    for (const [id, vehicle] of this.vehicleHistory) {
      if (presentIds.has(id)) vehicle.lastApiUpdateTime = now;
    }
    for (const [id, vru] of this.vruHistory) {
      if (presentIds.has(id)) vru.lastApiUpdateTime = now;
    }
  }

  /**
   * Update vehicles and VRUs with history tracking
   */
  private updateVehiclesWithHistory(data: any): void {
    const now = Date.now();
    const sdsmResponse = {
      intersectionID: data.intersectionID || 'unknown',
      intersection: data.intersection || 'Unknown Intersection',
      timestamp: data.timestamp,
      objects: data.objects || []
    };

    const newVehicles = SDSMDataService.extractVehicles(sdsmResponse);
    const newVRUs = SDSMDataService.extractVRUs(sdsmResponse);

    // Update with current API data timestamp
    this.updateObjectHistory(newVehicles, this.vehicleHistory, now, now);
    this.updateObjectHistory(newVRUs, this.vruHistory, now, now);
  }
  
  /**
   * Update object confidence levels based on staleness
   */
  private updateObjectsConfidence(): void {
    const now = Date.now();
    
    // Update vehicle confidence
    for (const vehicle of this.vehicleHistory.values()) {
      this.updateSingleObjectConfidence(vehicle, now);
    }
    
    // Update VRU confidence
    for (const vru of this.vruHistory.values()) {
      this.updateSingleObjectConfidence(vru, now);
    }
  }
  
  /**
   * Update confidence for a single object based on how stale it is
   */
  private updateSingleObjectConfidence(
    obj: VehicleWithHistory | VRUWithHistory,
    now: number
  ): void {
    const timeSinceUpdate = now - obj.lastApiUpdateTime;
    
    if (timeSinceUpdate <= this.STALE_WARNING_TIME_MS) {
      // Fresh data - full confidence
      obj.confidenceLevel = 1.0;
      obj.isStale = false;
    } else {
      // Stale data - gradually reduce confidence
      obj.isStale = true;
      const staleness = (timeSinceUpdate - this.STALE_WARNING_TIME_MS) / 
                       (this.STALE_REMOVAL_TIME_MS - this.STALE_WARNING_TIME_MS);
      
      obj.confidenceLevel = Math.max(0, 1.0 - staleness);
    }
  }
  
  /**
   * Generic function to update object history
   */
  private updateObjectHistory<T extends VehicleData | VRUData>(
    newObjects: T[],
    historyMap: Map<number, T & { 
      positionHistory: Array<any>; 
      firstSeenTime: number; 
      lastUpdateTime: number;
      lastApiUpdateTime: number;
      isStable: boolean; 
      isStale: boolean;
      confidenceLevel: number;
    }>,
    now: number,
    apiUpdateTime: number
  ): void {
    const currentObjectIds = new Set<number>();

    for (const obj of newObjects) {
      currentObjectIds.add(obj.id);
      
      let trackedObject = historyMap.get(obj.id);
      
      if (!trackedObject) {
        // New object - create with history tracking
        trackedObject = {
          ...obj,
          positionHistory: [],
          firstSeenTime: now,
          lastUpdateTime: now,
          lastApiUpdateTime: apiUpdateTime,
          isStable: false,
          isStale: false,
          confidenceLevel: 0.5
        };
        historyMap.set(obj.id, trackedObject);
      } else {
        // Existing object - update API timestamp
        trackedObject.lastApiUpdateTime = apiUpdateTime;
      }
      
      // Check if position actually changed
      const lastPosition = trackedObject.positionHistory[trackedObject.positionHistory.length - 1];
      const hasSignificantMovement = !lastPosition || 
        Math.abs(obj.coordinates[0] - lastPosition.coordinates[0]) > this.POSITION_CHANGE_THRESHOLD ||
        Math.abs(obj.coordinates[1] - lastPosition.coordinates[1]) > this.POSITION_CHANGE_THRESHOLD ||
        (obj.heading !== undefined && Math.abs((obj.heading || 0) - (lastPosition.heading || 0)) > 5);
      
      if (hasSignificantMovement || trackedObject.positionHistory.length === 0) {
        // Add to position history
        trackedObject.positionHistory.push({
          coordinates: [...obj.coordinates],
          timestamp: now,
          heading: obj.heading
        });
        
        // Limit history size
        if (trackedObject.positionHistory.length > this.MAX_HISTORY_COUNT) {
          trackedObject.positionHistory.shift();
        }
      }
      
      // Update object properties
      trackedObject.coordinates = [...obj.coordinates];
      trackedObject.heading = obj.heading;
      trackedObject.speed = obj.speed;
      if ('size' in obj && 'size' in trackedObject) {
        (trackedObject as any).size = obj.size;
      }
      trackedObject.lastUpdateTime = now;
      
      // Determine if object is stable enough to display
      const hasEnoughHistory = trackedObject.positionHistory.length >= this.MIN_HISTORY_COUNT;
      const hasBeenSeenLongEnough = (now - trackedObject.firstSeenTime) >= this.MIN_STABLE_TIME_MS;
      
      trackedObject.isStable = hasEnoughHistory || hasBeenSeenLongEnough;
    }
  }
  
  /**
   * Clean up only very old objects
   */
  private cleanupVeryStaleObjects(): void {
    const now = Date.now();
    
    // Only remove objects that are completely stale AND have very low confidence
    for (const [id, vehicle] of this.vehicleHistory.entries()) {
      if (now - vehicle.lastApiUpdateTime > this.STALE_REMOVAL_TIME_MS && 
          vehicle.confidenceLevel <= 0.1) {
        this.vehicleHistory.delete(id);
      }
    }
    
    for (const [id, vru] of this.vruHistory.entries()) {
      if (now - vru.lastApiUpdateTime > this.STALE_REMOVAL_TIME_MS && 
          vru.confidenceLevel <= 0.1) {
        this.vruHistory.delete(id);
      }
    }
  }
  
  /**
   * Update observable state with confidence-based filtering
   */
  private updateObservableState(): void {
    // Clean up very stale objects
    this.cleanupVeryStaleObjects();
    
    // Include stable objects with sufficient confidence
    const displayableVehicles = Array.from(this.vehicleHistory.values())
      .filter(v => v.isStable && v.confidenceLevel >= this.MIN_CONFIDENCE_TO_SHOW)
      .map(v => ({
        id: v.id,
        coordinates: this.getSmoothedPosition(v),
        heading: this.getSmoothedHeading(v),
        speed: v.speed,
        size: v.size
      }));
    
    const displayableVRUs = Array.from(this.vruHistory.values())
      .filter(v => v.isStable && v.confidenceLevel >= this.MIN_CONFIDENCE_TO_SHOW)
      .map(v => ({
        id: v.id,
        coordinates: this.getSmoothedPosition(v),
        heading: this.getSmoothedHeading(v),
        speed: v.speed
      }));
    
    runInAction(() => {
      this.vehicles = displayableVehicles;
      this.vrus = displayableVRUs;
      this.lastUpdateTime = Date.now();
      this.updateCount++;
    });
  }
  
  /**
   * Get smoothed position from history
   */
  private getSmoothedPosition(
    obj: { positionHistory: Array<{ coordinates: [number, number] }> }
  ): [number, number] {
    if (obj.positionHistory.length === 0) {
      return [0, 0];
    }
    
    if (obj.positionHistory.length === 1) {
      return [...obj.positionHistory[0].coordinates];
    }
    
    // Use last 2-3 positions for lighter smoothing
    const recentPositions = obj.positionHistory.slice(-2);
    const avgLat = recentPositions.reduce((sum, pos) => sum + pos.coordinates[0], 0) / recentPositions.length;
    const avgLng = recentPositions.reduce((sum, pos) => sum + pos.coordinates[1], 0) / recentPositions.length;
    
    return [avgLat, avgLng];
  }
  
  /**
   * Get smoothed heading from history
   */
  private getSmoothedHeading(
    obj: { positionHistory: Array<{ heading?: number }> }
  ): number | undefined {
    const headings = obj.positionHistory
      .slice(-2)
      .map(h => h.heading)
      .filter((h): h is number => h !== undefined);
    
    if (headings.length === 0) {
      return undefined;
    }
    
    return headings[headings.length - 1];
  }
  
  /**
   * Fetch data from RSU API
   */
  private async fetchFromRSU(): Promise<any> {
    const controller = new AbortController();
    this.activeController = controller;
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.FETCH_TIMEOUT_MS);

    const t0 = Date.now();

    try {
      const response = await fetch(this.API_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      this.activeController = null;

      if (!response.ok) {
        console.warn(`[SDSM] HTTP ${response.status} from API`);
        return null;
      }

      return await response.json();

    } catch (error) {
      const elapsed = Date.now() - t0;
      clearTimeout(timeoutId);
      this.activeController = null;

      if (error instanceof Error && error.name === 'AbortError') {
        if (!this.isPolling) return null;
        if (didTimeout) {
          console.warn(`[SDSM] Request TIMED OUT after ${elapsed}ms (limit: ${this.FETCH_TIMEOUT_MS}ms) - device may not have VPN/network access to the server`);
        } else {
          console.warn(`[SDSM] Request aborted by stop() after ${elapsed}ms`);
        }
        return null;
      }

      console.warn(`[SDSM] Fetch error after ${elapsed}ms:`, (error as Error).message);
      throw error;
    }
  }
  
  /**
   * Create hash of message to detect changes
   */
  private createHash(data: any): string {
    if (!data?.objects) return 'empty';
    
    const vehicles = data.objects
      .filter((obj: any) => obj.type === 'vehicle')
      .sort((a: any, b: any) => a.objectID - b.objectID);
    
    return `${data.timestamp}|${vehicles.length}|${
      vehicles.map((v: any) => 
        `${v.objectID}@${v.location?.coordinates?.join(',')}`
      ).join('|')
    }`;
  }
  
  /**
   * Stop polling
   */
  stop(): void {
    this.isPolling = false;
    this.activeController?.abort();
    this.activeController = null;

    runInAction(() => {
      this.isActive = false;
      this.vehicles = [];
      this.vrus = [];
      this.lastMessageHash = null;
      this.error = null;
    });
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Convert coordinates for map rendering
   */
  getMapCoordinates(data: VehicleData | VRUData): [number, number] {
    return SDSMDataService.toMapCoordinates(data);
  }
  
  /**
   * Get current vehicle count
   */
  get vehicleCount(): number {
    return this.vehicles.length;
  }
  
  /**
   * Get VRU count
   */
  get vruCount(): number {
    return this.vrus.length;
  }
  
  /**
   * Get enhanced statistics
   */
  get statistics() {
    const efficiency = this.totalMessages > 0 
      ? ((this.duplicateMessages / this.totalMessages) * 100).toFixed(1)
      : '0';
    
    const totalTracked = this.vehicleHistory.size + this.vruHistory.size;
    const stableCount = Array.from(this.vehicleHistory.values()).filter(v => v.isStable).length +
                       Array.from(this.vruHistory.values()).filter(v => v.isStable).length;
    const staleCount = Array.from(this.vehicleHistory.values()).filter(v => v.isStale).length +
                      Array.from(this.vruHistory.values()).filter(v => v.isStale).length;
    
    return {
      vehicleCount: this.vehicleCount,
      vruCount: this.vruCount,
      totalMessages: this.totalMessages,
      newMessages: this.newMessages,
      duplicateMessages: this.duplicateMessages,
      efficiency: `${efficiency}%`,
      isActive: this.isActive,
      hasError: this.error !== null,
      totalTracked,
      stableCount,
      staleCount,
      connectionHealthy: this.isConnectionHealthy,
      consecutiveFailures: this.consecutiveFailures,
      stabilityRate: totalTracked > 0 ? `${Math.round((stableCount / totalTracked) * 100)}%` : '0%',
      currentApiUrl: this.API_URL,
      currentIntersection: 'georgia'
    };
  }
  
  /**
   * Get current API endpoint
   */
  getCurrentApiEndpoint(): string {
    return this.API_URL;
  }
  
  /**
   * Check if  currently polling Georgia intersection
   */
  isPollingGeorgia(): boolean {
    return this.API_URL.includes('MLK_Georgia');
  }
  
  /**
   * Force clear all vehicles
   */
  clearAllVehicles(): void {
    this.vehicleHistory.clear();
    this.vruHistory.clear();
    runInAction(() => {
      this.vehicles = [];
      this.vrus = [];
      this.lastMessageHash = null;
      this.totalMessages = 0;
      this.newMessages = 0;
      this.duplicateMessages = 0;
    });
  }
  
  /**
   * Cleanup
   */
  cleanup(): void {
    this.stop();
    this.vehicleHistory.clear();
    this.vruHistory.clear();
  }
}

export default VehicleDisplayViewModel;
