// app/src/features/SpatService/viewModels/SpatViewModel.ts

import { makeAutoObservable, runInAction } from 'mobx';
import { SignalState } from '../models/SpatModels';
import { SpatApiService } from '../services/SpatApiService';
import { SpatWebSocketService } from '../services/SpatWebSocketService';
import { SpatZoneService, SpatZone } from '../services/SpatZoneService';

export class SpatViewModel {
  signalState: SignalState = SignalState.UNKNOWN;
  currentPhaseTiming: { minS: number; maxS: number } | null = null;
  currentLaneId: number | null = null;
  currentLaneIds: number[] = [];
  currentSignalGroup: number | null = null;
  currentIntersection: string | null = null;
  currentZoneName: string = '';
  isLoading: boolean = false;
  error: string | null = null;
  // True only when we have a live, fresh spat-events match for the current
  // zone's intersection. False (with shouldShowDisplay true) means "inside an
  // active zone but no SPaT coverage" — surfaced explicitly in the UI rather
  // than silently showing nothing.
  spatDataAvailable: boolean = false;

  preferredZoneIds: string[] = [];

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

  setPreferredZoneIds(ids: string[]): void {
    this.preferredZoneIds = ids;
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
    SpatWebSocketService.ensureConnected();

    if (this.updateInterval) return;

    this.checkZoneAndUpdateState();

    this.updateInterval = setInterval(() => {
      this.pollSpatData();
    }, this.FAST_UPDATE_INTERVAL);
  }

  stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private checkZoneAndUpdateState(): void {
    const newZone = SpatZoneService.findZoneForPosition(this.userPosition, this.preferredZoneIds);

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
      this.currentIntersection = zone.intersectionName;
      this.currentLaneId = displayLaneId;
      this.currentLaneIds = [...laneIds];
      this.currentSignalGroup = zone.signalGroup;
      this.currentZoneName = zone.name;
    });

    if (!this.zoneDisplayState.has(zone.id)) {
      this.zoneDisplayState.set(zone.id, false);
    }

    // Pull whatever's cached from the live spat-events stream immediately.
    this.pollSpatData();
  }

  private exitZone(): void {
    runInAction(() => {
      this.currentIntersection = null;
      this.currentLaneId = null;
      this.currentLaneIds = [];
      this.currentSignalGroup = null;
      this.currentZoneName = '';
      this.signalState = SignalState.UNKNOWN;
      this.currentPhaseTiming = null;
      this.spatDataAvailable = false;
      this.error = null;
      this.isLoading = false;
    });
  }

  // Reads whatever SpatWebSocketService has cached for the current zone's
  // intersection — no network round-trip, so this is safe to call on every tick.
  private pollSpatData(): void {
    if (!this.currentZone || this.currentSignalGroup === null || !this.currentIntersection) {
      return;
    }

    const spatData = SpatWebSocketService.getLatest(this.currentIntersection);

    if (!spatData) {
      runInAction(() => {
        this.signalState = SignalState.UNKNOWN;
        this.currentPhaseTiming = null;
        this.spatDataAvailable = false;
        this.error = 'SPaT data unavailable for this intersection';
      });
      return;
    }

    const signalState = SpatApiService.getSignalStateForGroup(spatData, this.currentSignalGroup);
    const phaseTiming = SpatApiService.getPhaseTimingForGroup(spatData, this.currentSignalGroup);

    runInAction(() => {
      this.signalState = signalState;
      this.currentPhaseTiming = phaseTiming;
      this.spatDataAvailable = true;
      this.error = null;
    });
  }

  // Whether the turn/light UI should render at all — no longer requires real
  // signal data, since an active zone with no SPaT coverage should still show
  // an explicit "unavailable" indicator (see spatUnavailable) rather than
  // nothing at all.
  get shouldShowDisplay(): boolean {
    if (!this.currentZone || this.currentSignalGroup === null) {
      return false;
    }

    // Same behavior requirement: only show after crossing entry line,
    // and hide again after crossing exit line.
    return this.zoneDisplayState.get(this.currentZone.id) === true;
  }

  // True once the user is inside an active zone but no live SPaT data has
  // matched its intersection — the case the UI must call out explicitly.
  get spatUnavailable(): boolean {
    return this.shouldShowDisplay && !this.spatDataAvailable;
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

  get phaseDurationLabel(): string {
    if (!this.currentPhaseTiming || this.currentPhaseTiming.maxS <= 0) return '--';

    const lo = Math.round(this.currentPhaseTiming.minS);
    const hi = Math.round(this.currentPhaseTiming.maxS);

    return lo === hi ? `~${lo}s` : `~${lo}–${hi}s`;
  }

  get laneDisplayText(): string {
    if (this.currentSignalGroup === null || !this.currentIntersection) return '';

    const laneText = this.currentLaneIds.length ? `L${this.currentLaneIds.join(',')}` : 'L?';

    return `${this.currentIntersection} ${laneText} SG${this.currentSignalGroup}`;
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
      this.currentPhaseTiming = null;
      this.spatDataAvailable = false;
      this.error = null;
      this.isLoading = false;
    });
  }
}

export default SpatViewModel;
