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

  // Snapshot of the above, taken on every tick while shouldShowDisplay is
  // true. Lets the display getters keep reporting the last known SPaT read
  // for EXIT_GRACE_MS after actually leaving the zone, instead of blanking
  // out the instant GPS crosses the exit line — see displaySignalState etc.
  private lastSignalState: SignalState = SignalState.UNKNOWN;
  private lastPhaseTiming: { minS: number; maxS: number } | null = null;
  private lastSpatUnavailable: boolean = false;
  private graceClearTimeout: NodeJS.Timeout | null = null;
  // Keep in sync with PreemptionViewModel's EXIT_GRACE_MS — both linger the
  // same TrafficLightPanel render for the same window after zone exit.
  private static readonly EXIT_GRACE_MS = 3000;

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
    // No SpatWebSocketService connection here — it's demand-driven per zone
    // (see enterZone/exitZone) rather than held open for the whole session,
    // since at any moment we only ever care about one intersection: whichever
    // zone the user currently occupies.
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
    // Cancel any pending grace-clear from a just-left zone — we're back
    // inside a zone, so the live snapshot below will keep the display fresh.
    if (this.graceClearTimeout) {
      clearTimeout(this.graceClearTimeout);
      this.graceClearTimeout = null;
    }

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

    // Connect (or resubscribe, on a direct zone-to-zone hop) to this zone's
    // intersection specifically — no CUIP coverage at all (e.g. the lab
    // bench controller) means no connection is worth holding open.
    if (zone.intersectionName) {
      SpatWebSocketService.connectFor(zone.intersectionName);
    } else {
      SpatWebSocketService.disconnect();
    }

    // Pull whatever's cached from the live spat-events stream immediately.
    this.pollSpatData();
  }

  private exitZone(): void {
    SpatWebSocketService.disconnect();

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

    this.scheduleGraceClear();
  }

  private scheduleGraceClear(): void {
    if (this.graceClearTimeout) {
      clearTimeout(this.graceClearTimeout);
    }
    this.graceClearTimeout = setTimeout(() => {
      this.graceClearTimeout = null;
      runInAction(() => {
        this.lastSignalState = SignalState.UNKNOWN;
        this.lastPhaseTiming = null;
        this.lastSpatUnavailable = false;
      });
    }, SpatViewModel.EXIT_GRACE_MS);
  }

  // Reads whatever SpatWebSocketService has cached for the current zone's
  // intersection — no network round-trip, so this is safe to call on every tick.
  private pollSpatData(): void {
    if (!this.currentZone || this.currentSignalGroup === null || !this.currentIntersection) {
      return;
    }

    const spatData = SpatWebSocketService.getLatest(this.currentIntersection);

    runInAction(() => {
      if (!spatData) {
        this.signalState = SignalState.UNKNOWN;
        this.currentPhaseTiming = null;
        this.spatDataAvailable = false;
        this.error = 'SPaT data unavailable for this intersection';
      } else {
        this.signalState = SpatApiService.getSignalStateForGroup(spatData, this.currentSignalGroup!);
        this.currentPhaseTiming = SpatApiService.getPhaseTimingForGroup(spatData, this.currentSignalGroup!);
        this.spatDataAvailable = true;
        this.error = null;
      }

      if (this.shouldShowDisplay) {
        this.lastSignalState = this.signalState;
        this.lastPhaseTiming = this.currentPhaseTiming;
        this.lastSpatUnavailable = this.spatUnavailable;
      }
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

  // True when the current zone's intersection has a CUIP cuip_slug at all —
  // i.e. CUIP's spat-events stream is expected to carry it eventually. False
  // for zones on intersections CUIP doesn't configure (lab/bench
  // controllers), which should never surface a "SPaT unavailable" alert since
  // no live match will ever exist for them.
  get hasCuipCoverage(): boolean {
    return this.currentIntersection !== null;
  }

  // True once the user is inside an active zone whose intersection CUIP is
  // expected to cover, but no live SPaT data has matched it yet — the case
  // the UI must call out explicitly. Zones with no CUIP coverage at all stay
  // silent instead (see hasCuipCoverage).
  get spatUnavailable(): boolean {
    return this.shouldShowDisplay && this.hasCuipCoverage && !this.spatDataAvailable;
  }

  // Display-only variants that linger the last live value for
  // EXIT_GRACE_MS after leaving a zone, instead of snapping to the "nothing
  // here" state the instant GPS crosses the exit line. TrafficLightPanel
  // reads these (not the raw fields above) so it keeps showing the light the
  // driver just had for a couple seconds after the intersection is behind them.
  get displaySignalState(): SignalState {
    return this.shouldShowDisplay ? this.signalState : this.lastSignalState;
  }

  get displaySpatUnavailable(): boolean {
    return this.shouldShowDisplay ? this.spatUnavailable : this.lastSpatUnavailable;
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
    return this.formatPhaseDuration(this.currentPhaseTiming);
  }

  get displayPhaseDurationLabel(): string {
    return this.formatPhaseDuration(this.shouldShowDisplay ? this.currentPhaseTiming : this.lastPhaseTiming);
  }

  private formatPhaseDuration(timing: { minS: number; maxS: number } | null): string {
    if (!timing || timing.maxS <= 0) return '--';

    const lo = Math.round(timing.minS);
    const hi = Math.round(timing.maxS);

    return lo === hi ? `~${lo}s` : `~${lo}–${hi}s`;
  }

  get laneDisplayText(): string {
    if (this.currentSignalGroup === null || !this.currentIntersection) return '';

    const laneText = this.currentLaneIds.length ? `L${this.currentLaneIds.join(',')}` : 'L?';

    return `${this.currentIntersection} ${laneText} SG${this.currentSignalGroup}`;
  }

  cleanup(): void {
    this.stopMonitoring();
    SpatWebSocketService.disconnect();
    this.currentZone = null;
    this.previousPosition = null;
    this.zoneDisplayState.clear();

    if (this.graceClearTimeout) {
      clearTimeout(this.graceClearTimeout);
      this.graceClearTimeout = null;
    }

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
