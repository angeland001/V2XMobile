// app/src/features/SDSM/viewmodels/VehicleDisplayViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { VehicleData, VRUData } from '../models/SDSMTypes';
import { SDSMDataService } from '../services/SDSMDataService';
import { TESTING_CONFIG } from '../../../testingFeatures/TestingConfig';
import { API_CONFIG } from '../../../core/api/config';

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
  // [lat, lng]; null until the app gets a first GPS fix, in which case
  // objects are shown unfiltered rather than being hidden pending location.
  userLocation: [number, number] | null = null;
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

  // Stability settings
  private readonly MIN_HISTORY_COUNT = 2;
  private readonly MIN_STABLE_TIME_MS = 300;
  private readonly MAX_HISTORY_COUNT = 8;
  private readonly POSITION_CHANGE_THRESHOLD = 0.00001;

  // Graceful degradation settings
  private readonly STALE_WARNING_TIME_MS = 3000;
  private readonly STALE_REMOVAL_TIME_MS = 8000;
  private readonly MIN_CONFIDENCE_TO_SHOW = 0.3;

  // Reconnect settings
  private readonly RECONNECT_DELAY_MS = 2000;

  // Only render objects within this range of the user, so the map isn't
  // paying render/memory cost for SDSM activity nowhere near them.
  // Configurable via Settings > SDSM Detection Radius; MainViewModel keeps
  // this in sync with SettingsViewModel.sdsmDisplayRadiusM.
  sdsmMaxRadiusM = 250;
  // Bypasses sdsmMaxRadiusM entirely when true — Settings > "Show All SDSM".
  // MainViewModel keeps this in sync with
  // SettingsViewModel.sdsmShowAllRegardlessOfDistance.
  showAllRegardlessOfDistance = false;

  // Internal tracking with history
  private vehicleHistory: Map<number, VehicleWithHistory> = new Map();
  private vruHistory: Map<number, VRUWithHistory> = new Map();

  // WebSocket state
  private activeWebSocket: WebSocket | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private confidenceIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastMessageData: string | null = null;

  constructor() {
    makeAutoObservable(this, {
      // Non-serializable internals — exclude from observation
      activeWebSocket: false,
      reconnectTimeoutId: false,
      confidenceIntervalId: false,
      lastMessageData: false,
      vehicleHistory: false,
      vruHistory: false,
    });
  }

  /**
   * Start the WebSocket stream
   */
  start(): void {
    if (!TESTING_CONFIG.ENABLE_SDSM_API) {
      runInAction(() => {
        this.vehicles = [];
        this.vrus = [];
        this.isActive = false;
      });
      return;
    }

    if (this.isActive) return;

    runInAction(() => {
      this.isActive = true;
      this.error = null;
      this.consecutiveFailures = 0;
      this.lastSuccessfulFetch = Date.now();
      this.isConnectionHealthy = true;
    });

    this.connectWebSocket();

    // Drive confidence/staleness updates independently of message cadence
    this.confidenceIntervalId = setInterval(() => {
      this.updateObjectsConfidence();
      this.updateObservableState();
    }, 500);
  }

  /**
   * Open the WebSocket and set up handlers
   */
  private connectWebSocket(): void {
    if (!this.isActive) return;

    try {
      const ws = new WebSocket(API_CONFIG.SDSM_WS_URL);
      this.activeWebSocket = ws;

      ws.onopen = () => {
        runInAction(() => {
          this.consecutiveFailures = 0;
          this.lastSuccessfulFetch = Date.now();
          this.isConnectionHealthy = true;
          this.error = null;
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string'
            ? JSON.parse(event.data)
            : event.data;

          runInAction(() => { this.totalMessages++; });
          const messageKey = this.createMessageKey(data);

          if (messageKey !== this.lastMessageData) {
            this.updateVehiclesWithHistory(data);
            this.lastMessageData = messageKey;
            runInAction(() => { this.newMessages++; });
          } else {
            this.refreshLastApiUpdateTime(data);
            runInAction(() => { this.duplicateMessages++; });
          }
        } catch {
          // Skip malformed messages
        }
      };

      ws.onerror = () => {
        runInAction(() => {
          this.consecutiveFailures++;
          this.isConnectionHealthy = false;
        });
      };

      ws.onclose = () => {
        this.activeWebSocket = null;
        if (this.isActive) {
          this.scheduleReconnect();
        }
      };
    } catch {
      runInAction(() => {
        this.consecutiveFailures++;
        this.isConnectionHealthy = false;
      });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isActive) return;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connectWebSocket();
    }, this.RECONNECT_DELAY_MS);
  }

  /**
   * On a duplicate frame, refresh API timestamps so objects don't go stale
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

    this.updateObjectHistory(newVehicles, this.vehicleHistory, now, now);
    this.updateObjectHistory(newVRUs, this.vruHistory, now, now);
  }

  /**
   * Update confidence levels based on staleness
   */
  private updateObjectsConfidence(): void {
    const now = Date.now();
    for (const vehicle of this.vehicleHistory.values()) {
      this.updateSingleObjectConfidence(vehicle, now);
    }
    for (const vru of this.vruHistory.values()) {
      this.updateSingleObjectConfidence(vru, now);
    }
  }

  private updateSingleObjectConfidence(
    obj: VehicleWithHistory | VRUWithHistory,
    now: number
  ): void {
    const timeSinceUpdate = now - obj.lastApiUpdateTime;

    if (timeSinceUpdate <= this.STALE_WARNING_TIME_MS) {
      obj.confidenceLevel = 1.0;
      obj.isStale = false;
    } else {
      obj.isStale = true;
      const staleness = (timeSinceUpdate - this.STALE_WARNING_TIME_MS) /
                       (this.STALE_REMOVAL_TIME_MS - this.STALE_WARNING_TIME_MS);
      obj.confidenceLevel = Math.max(0, 1.0 - staleness);
    }
  }

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
    for (const obj of newObjects) {
      let trackedObject = historyMap.get(obj.id);

      if (!trackedObject) {
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
        trackedObject.lastApiUpdateTime = apiUpdateTime;
      }

      const lastPosition = trackedObject.positionHistory[trackedObject.positionHistory.length - 1];
      const hasSignificantMovement = !lastPosition ||
        Math.abs(obj.coordinates[0] - lastPosition.coordinates[0]) > this.POSITION_CHANGE_THRESHOLD ||
        Math.abs(obj.coordinates[1] - lastPosition.coordinates[1]) > this.POSITION_CHANGE_THRESHOLD ||
        (obj.heading !== undefined && Math.abs((obj.heading || 0) - (lastPosition.heading || 0)) > 5);

      if (hasSignificantMovement || trackedObject.positionHistory.length === 0) {
        trackedObject.positionHistory.push({
          coordinates: [...obj.coordinates],
          timestamp: now,
          heading: obj.heading
        });

        if (trackedObject.positionHistory.length > this.MAX_HISTORY_COUNT) {
          trackedObject.positionHistory.shift();
        }
      }

      trackedObject.coordinates = [...obj.coordinates];
      trackedObject.heading = obj.heading;
      trackedObject.speed = obj.speed;
      if ('size' in obj && 'size' in trackedObject) {
        (trackedObject as any).size = obj.size;
      }
      trackedObject.lastUpdateTime = now;

      const hasEnoughHistory = trackedObject.positionHistory.length >= this.MIN_HISTORY_COUNT;
      const hasBeenSeenLongEnough = (now - trackedObject.firstSeenTime) >= this.MIN_STABLE_TIME_MS;
      trackedObject.isStable = hasEnoughHistory || hasBeenSeenLongEnough;
    }
  }

  private cleanupVeryStaleObjects(): void {
    const now = Date.now();

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

  private updateObservableState(): void {
    this.cleanupVeryStaleObjects();

    let displayableVehicles = Array.from(this.vehicleHistory.values())
      .filter(v => v.isStable && v.confidenceLevel >= this.MIN_CONFIDENCE_TO_SHOW)
      .map(v => ({
        id: v.id,
        coordinates: this.getSmoothedPosition(v),
        heading: this.getSmoothedHeading(v),
        speed: v.speed,
        size: v.size
      }));

    let displayableVRUs = Array.from(this.vruHistory.values())
      .filter(v => v.isStable && v.confidenceLevel >= this.MIN_CONFIDENCE_TO_SHOW)
      .map(v => ({
        id: v.id,
        coordinates: this.getSmoothedPosition(v),
        heading: this.getSmoothedHeading(v),
        speed: v.speed
      }));

    if (this.userLocation && !this.showAllRegardlessOfDistance) {
      displayableVehicles = SDSMDataService.filterByRadius(displayableVehicles, this.userLocation, this.sdsmMaxRadiusM);
      displayableVRUs = SDSMDataService.filterByRadius(displayableVRUs, this.userLocation, this.sdsmMaxRadiusM);
    }

    runInAction(() => {
      this.vehicles = displayableVehicles;
      this.vrus = displayableVRUs;
      this.lastUpdateTime = Date.now();
      this.updateCount++;
    });
  }

  private getSmoothedPosition(
    obj: { positionHistory: Array<{ coordinates: [number, number] }> }
  ): [number, number] {
    if (obj.positionHistory.length === 0) return [0, 0];
    if (obj.positionHistory.length === 1) return [...obj.positionHistory[0].coordinates];

    const recentPositions = obj.positionHistory.slice(-2);
    const avgLat = recentPositions.reduce((sum, pos) => sum + pos.coordinates[0], 0) / recentPositions.length;
    const avgLng = recentPositions.reduce((sum, pos) => sum + pos.coordinates[1], 0) / recentPositions.length;
    return [avgLat, avgLng];
  }

  private getSmoothedHeading(
    obj: { positionHistory: Array<{ heading?: number }> }
  ): number | undefined {
    const headings = obj.positionHistory
      .slice(-2)
      .map(h => h.heading)
      .filter((h): h is number => h !== undefined);

    return headings.length === 0 ? undefined : headings[headings.length - 1];
  }

  private createMessageKey(data: any): string {
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
   * Stop streaming and close the WebSocket
   */
  stop(): void {
    if (this.confidenceIntervalId) {
      clearInterval(this.confidenceIntervalId);
      this.confidenceIntervalId = null;
    }
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.activeWebSocket) {
      this.activeWebSocket.onclose = null; // Prevent reconnect loop
      this.activeWebSocket.close();
      this.activeWebSocket = null;
    }

    runInAction(() => {
      this.isActive = false;
      this.vehicles = [];
      this.vrus = [];
      this.lastMessageData = null;
      this.error = null;
    });
  }

  setUserLocation(location: [number, number]): void {
    runInAction(() => {
      this.userLocation = location;
    });
  }

  setDisplayRadius(meters: number): void {
    runInAction(() => {
      this.sdsmMaxRadiusM = meters;
    });
  }

  setShowAllRegardlessOfDistance(showAll: boolean): void {
    runInAction(() => {
      this.showAllRegardlessOfDistance = showAll;
    });
  }

  getMapCoordinates(data: VehicleData | VRUData): [number, number] {
    return SDSMDataService.toMapCoordinates(data);
  }

  get vehicleCount(): number {
    return this.vehicles.length;
  }

  get vruCount(): number {
    return this.vrus.length;
  }

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
      currentWsUrl: API_CONFIG.SDSM_WS_URL,
      currentIntersection: 'georgia'
    };
  }

  getCurrentApiEndpoint(): string {
    return API_CONFIG.SDSM_WS_URL;
  }

  // Only Georgia is supported; kept for call-site compatibility
  setApiUrl(_intersection: 'georgia'): void {
    this.vehicleHistory.clear();
    this.vruHistory.clear();
    runInAction(() => {
      this.vehicles = [];
      this.vrus = [];
      this.lastMessageData = null;
    });
  }

  isPollingGeorgia(): boolean {
    return true;
  }

  clearAllVehicles(): void {
    this.vehicleHistory.clear();
    this.vruHistory.clear();
    runInAction(() => {
      this.vehicles = [];
      this.vrus = [];
      this.lastMessageData = null;
      this.totalMessages = 0;
      this.newMessages = 0;
      this.duplicateMessages = 0;
    });
  }

  cleanup(): void {
    this.stop();
    this.vehicleHistory.clear();
    this.vruHistory.clear();
  }
}

export default VehicleDisplayViewModel;
