// app/src/features/SpatService/viewModels/SpatViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { SignalState } from '../models/SpatModels';
import { SpatApiService } from '../services/SpatApiService';
import { SpatZoneService, SpatZone } from '../services/SpatZoneService';

export class SpatViewModel {
  signalState: SignalState = SignalState.UNKNOWN;
  currentLaneId: number | null = null;
  currentLaneIds: number[] = [];
  currentSignalGroup: number | null = null;
  currentIntersection: 'georgia' | 'houston' | null = null;
  currentZoneName: string = '';
  isLoading: boolean = false;
  error: string | null = null;

  private userPosition: [number, number] = [0, 0];
  private previousPosition: [number, number] | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private currentZone: SpatZone | null = null;
  private lastZoneCheckTime: number = 0;

  // Zone-level display gate driven by entry/exit line crossing.
  private zoneDisplayState: Map<string, boolean> = new Map();

  private readonly FAST_UPDATE_INTERVAL = 500;
  private readonly ZONE_CHECK_THROTTLE = 100;

  constructor() {
    makeAutoObservable(this);
  }

  setUserPosition(position: [number, number]): void {
    if (this.previousPosition && this.previousPosition[0] !== 0 && this.previousPosition[1] !== 0) {
      this.checkLineCrossing(this.previousPosition, position);
    }

    this.userPosition = position;
    this.previousPosition = position;

    const now = Date.now();
    if (now - this.lastZoneCheckTime >= this.ZONE_CHECK_THROTTLE) {
      this.lastZoneCheckTime = now;
      this.checkZoneAndUpdateState();
    }
  }

  private checkLineCrossing(prevPos: [number, number], currPos: [number, number]): void {
    const zones = SpatZoneService.getActiveZones();

    for (const zone of zones) {
      const crossedEntry = SpatZoneService.crossesEntryLine(prevPos, currPos, zone);
      const crossedExit = SpatZoneService.crossesExitLine(prevPos, currPos, zone);

      const previousDisplayState = this.zoneDisplayState.get(zone.id) === true;

      let nextDisplayState = previousDisplayState;
      if (crossedEntry && crossedExit) {
        // If both are hit (coarse GPS step), resolve by where current point landed.
        nextDisplayState = SpatZoneService.isPointInZone(currPos, zone);
      } else if (crossedEntry) {
        nextDisplayState = true;
      } else if (crossedExit) {
        nextDisplayState = false;
      }

      if (nextDisplayState !== previousDisplayState) {
        this.zoneDisplayState.set(zone.id, nextDisplayState);
      }
    }
  }

  startMonitoring(): void {
    if (this.updateInterval) return;

    this.checkZoneAndUpdateState();

    this.updateInterval = setInterval(() => {
      this.updateSpatData();
    }, this.FAST_UPDATE_INTERVAL);
  }

  stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private checkZoneAndUpdateState(): void {
    const newZone = SpatZoneService.findZoneForPosition(this.userPosition);

    if (newZone?.id !== this.currentZone?.id) {
      this.currentZone = newZone;

      if (newZone) {
        this.enterZone(newZone);
      } else {
        this.exitZone();
      }
    }
  }

  private pickDisplayLaneId(laneIds: number[]): number | null {
    if (!laneIds.length) return null;

    // Preserve old lane-specific UI behaviors when these lane numbers exist.
    const preferredLaneOrder = [1, 4, 5, 8, 10, 11];
    const preferredLane = preferredLaneOrder.find((laneId) => laneIds.includes(laneId));

    return preferredLane ?? laneIds[0];
  }

  private enterZone(zone: SpatZone): void {
    const laneIds = Array.isArray(zone.laneIds) ? zone.laneIds : [];
    const displayLaneId = this.pickDisplayLaneId(laneIds);

    runInAction(() => {
      this.currentIntersection = zone.intersection;
      this.currentLaneId = displayLaneId;
      this.currentLaneIds = [...laneIds];
      this.currentSignalGroup = zone.signalGroup;
      this.currentZoneName = zone.name;
      this.error = null;
    });

    if (!this.zoneDisplayState.has(zone.id)) {
      this.zoneDisplayState.set(zone.id, false);
    }

    console.log(`[SPAT] In zone '${zone.name}'. Polling signal group ${zone.signalGroup}.`);

    // Start pulling SPaT immediately once user is in-zone.
    this.fetchSpatDataImmediate(zone.intersection, zone.signalGroup);
  }

  private exitZone(): void {
    runInAction(() => {
      this.currentIntersection = null;
      this.currentLaneId = null;
      this.currentLaneIds = [];
      this.currentSignalGroup = null;
      this.currentZoneName = '';
      this.signalState = SignalState.UNKNOWN;
      this.error = null;
      this.isLoading = false;
    });
  }

  private async updateSpatData(): Promise<void> {
    if (!this.currentZone || !this.currentSignalGroup || !this.currentIntersection) {
      return;
    }

    await this.fetchSpatDataImmediate(this.currentIntersection, this.currentSignalGroup);
  }

  private async fetchSpatDataImmediate(
    intersection: 'georgia' | 'houston',
    signalGroup: number
  ): Promise<void> {
    runInAction(() => {
      this.isLoading = true;
    });

    try {
      // Requested runtime path: use MLK_Georgia feed when in the active zone.
      const spatData = intersection === 'georgia'
        ? await SpatApiService.fetchMlkGeorgiaSpatData()
        : await SpatApiService.fetchSpatData(intersection);

      if (!spatData) {
        runInAction(() => {
          this.error = 'No SPaT data';
          this.signalState = SignalState.UNKNOWN;
          this.isLoading = false;
        });
        return;
      }

      const signalState = SpatApiService.getSignalStateForGroup(spatData, signalGroup);

      runInAction(() => {
        this.signalState = signalState;
        this.error = null;
        this.isLoading = false;
      });
    } catch (_error) {
      runInAction(() => {
        this.error = 'SPaT fetch failed';
        this.signalState = SignalState.UNKNOWN;
        this.isLoading = false;
      });
    }
  }

  get shouldShowDisplay(): boolean {
    const hasValidData =
      this.currentZone !== null &&
      this.currentSignalGroup !== null &&
      this.signalState !== SignalState.UNKNOWN;

    if (!hasValidData || !this.currentZone) {
      return false;
    }

    // Same behavior requirement: only show after crossing entry line,
    // and hide again after crossing exit line.
    return this.zoneDisplayState.get(this.currentZone.id) === true;
  }

  get signalStatusText(): string {
    switch (this.signalState) {
      case SignalState.GREEN:
        return 'GO';
      case SignalState.YELLOW:
        return 'CAUTION';
      case SignalState.RED:
        return 'STOP';
      default:
        return 'NO SIGNAL';
    }
  }

  get signalColor(): string {
    switch (this.signalState) {
      case SignalState.GREEN:
        return '#22c55e';
      case SignalState.YELLOW:
        return '#eab308';
      case SignalState.RED:
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  }

  get laneDisplayText(): string {
    if (this.currentSignalGroup === null || !this.currentIntersection) return '';

    const intersectionPrefix = this.currentIntersection === 'georgia' ? 'GA' : 'HOU';
    const laneText = this.currentLaneIds.length ? `L${this.currentLaneIds.join(',')}` : 'L?';

    return `${intersectionPrefix} ${laneText} SG${this.currentSignalGroup}`;
  }

  cleanup(): void {
    this.stopMonitoring();
    this.currentZone = null;
    this.previousPosition = null;
    this.zoneDisplayState.clear();

    runInAction(() => {
      this.currentLaneId = null;
      this.currentLaneIds = [];
      this.currentSignalGroup = null;
      this.currentIntersection = null;
      this.currentZoneName = '';
      this.signalState = SignalState.UNKNOWN;
      this.error = null;
      this.isLoading = false;
    });
  }
}
