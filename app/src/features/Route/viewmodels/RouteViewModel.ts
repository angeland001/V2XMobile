import { makeAutoObservable, reaction, runInAction } from 'mobx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lineString,
  booleanIntersects,
  booleanPointInPolygon,
  polygon,
  point,
  nearestPointOnLine,
  lineIntersect,
  bearing,
  along,
  length as turfLength,
  distance as turfDistance,
} from '@turf/turf';
import type { Feature, LineString, Point } from 'geojson';
import { TimService } from '../../TIM/services/TimService';
import { TimHit } from '../../TIM/models/TimTypes';
import { SpatZoneService } from '../../SpatService/services/SpatZoneService';
import { PreemptionConfigService } from '../../preemption/services/PreemptionConfigService';
import { VoiceGuidanceService } from '../services/VoiceGuidanceService';

const RECENT_ROUTES_STORAGE_KEY = 'v2x:recentRoutes';
const MAX_RECENT_ROUTES = 5;

// Distance ahead of the snapped position to aim the nav camera's heading at.
const ROUTE_BEARING_LOOKAHEAD_METERS = 20;

export type { TimHit };

export interface GeocodingSuggestion {
  id: string;
  placeName: string;
  center: [number, number]; // [lng, lat]
}

export interface RouteStep {
  distance: number;          // meters
  duration: number;          // seconds
  name: string;              // street / road name
  maneuverType: string;      // 'turn' | 'arrive' | 'depart' | 'continue' | etc.
  maneuverModifier?: string; // 'right' | 'left' | 'straight' | 'slight right' | etc.
  instruction: string;       // full human-readable instruction
  coordinate: [number, number]; // [lng, lat] at step start
}

export interface PreemptionHit {
  zoneId: string;
  zoneName: string;
  polygon: [number, number][];
}

// A previously-routed-to destination, persisted locally so it can be
// re-selected from the "Recent Routes" list without re-typing/re-geocoding.
export interface RecentRoute {
  id: string;
  placeName: string;
  center: [number, number]; // [lng, lat]
}

// One candidate route returned by the Directions API (alternatives=true) —
// everything needed to both draw it on the map and, if selected, become the
// active route (see applyRouteOption).
export interface RouteOption {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  distanceLabel: string;
  durationLabel: string;
  steps: RouteStep[];
}

const CHATT_PROXIMITY = '-85.3099,35.0456';
// 30m was tripping on ordinary GPS drift (multi-lane roads, bridges, urban
// canyon) well before the driver had actually left the route — each false
// trigger refetches the whole route from the current position, which
// recomputes TIM zone entry points against new geometry and made the
// "distance ahead" jump to an unrelated number (see OFF_ROUTE_CONFIRM_MS).
const OFF_ROUTE_THRESHOLD_M = 50;
// A single noisy sample past the threshold shouldn't reroute — require the
// deviation to still be past it after this long (see offRouteSinceMs below)
// so a momentary GPS blip doesn't tear down a still-valid route.
const OFF_ROUTE_CONFIRM_MS = 1_500;
const REROUTE_DEBOUNCE_MS = 2_500;
const OFF_ROUTE_CHECK_INTERVAL_MS = 200;
const TIM_ALERT_LOOKAHEAD_M = 500;

// Distance thresholds (meters) at which to speak voice instructions
const VOICE_THRESHOLDS = [
  { dist: 500, label: '500' },
  { dist: 200, label: '200' },
  { dist: 50,  label: 'now' },
];

export class RouteViewModel {
  // ── Search & destination ──────────────────────────────────────────────────
  toText: string = '';
  toSuggestions: GeocodingSuggestion[] = [];
  showSuggestions: boolean = false;
  toCoord: [number, number] | null = null;
  toLabel: string = '';
  userLocation: [number, number] | null = null;
  // Most-recent-first, deduped by destination coordinate, capped at
  // MAX_RECENT_ROUTES. Populated from AsyncStorage on construction and
  // updated whenever a route is successfully fetched (see fetchDirections).
  recentRoutes: RecentRoute[] = [];

  // ── Route overview ────────────────────────────────────────────────────────
  // All candidate routes from the last fetch (Directions alternatives=true);
  // routeCoordinates/routeDistance/etc. below always mirror routeOptions[selectedRouteIndex].
  routeOptions: RouteOption[] = [];
  selectedRouteIndex: number = 0;
  routeCoordinates: [number, number][] = [];
  // routeCoordinates trimmed to the portion still ahead of the user — the
  // traveled portion behind them is dropped as they pass it. Updated in
  // updateProgress(); RouteLayer draws this instead of routeCoordinates
  // once navigation is active.
  remainingRouteCoordinates: [number, number][] = [];
  routeDistance: string = '';
  routeDuration: string = '';
  isLoadingRoute: boolean = false;
  routeError: string | null = null;
  hasActiveRoute: boolean = false;
  isNavigating: boolean = false;
  isRerouting: boolean = false;

  // ── Step-by-step navigation ───────────────────────────────────────────────
  steps: RouteStep[] = [];
  currentStepIndex: number = 0;
  distanceToNextManeuver: number = Infinity;
  remainingDistanceM: number = 0;
  remainingDurationS: number = 0;
  totalDurationS: number = 0;
  hasArrived: boolean = false;
  isOverviewMode: boolean = false;
  voiceGuidanceEnabled: boolean = true;
  // Measured height of NavigationBanner (from its onLayout), shared so any
  // overlay positioned below it — even ones mounted outside MapView's tree,
  // like TimToast — can clear it without guessing a fixed offset.
  navBannerHeightPx: number = 130;
  // Extra vertical space MapView reserves directly below the nav banner for
  // its own top-docked HUD elements (currently just the pedestrian warning).
  // TimToast, mounted outside MapView's tree at the app root, adds this to
  // its own offset so it stacks below those elements instead of over them.
  topHudExtraPx: number = 0;

  // ── V2X analysis ──────────────────────────────────────────────────────────
  timHits: TimHit[] = [];
  preemptionHits: PreemptionHit[] = [];
  // Zones on the active route within TIM_ALERT_LOOKAHEAD_M that haven't been
  // entered yet — drives the persistent (non-dismissing) nav alert UI.
  approachingTimZones: TimHit[] = [];
  approachingTimZoneDistancesM: Map<number, number> = new Map();
  // Zones the user is currently driving through, or has just exited but not
  // yet passed (route position still behind the zone's entry point) — see
  // _insideZoneIds below. Kept separate from approachingTimZones, which is
  // specifically the "not there yet" list.
  insideTimZones: TimHit[] = [];
  // Where each hit's entry point falls along the route, as a 0–1 fraction of
  // total route length — drives the mile-marker strip on RoutePreviewSheet.
  // Keyed the same as the hit arrays above (timId / zoneId); a hit missing
  // from the map just means its position couldn't be resolved (malformed
  // geometry) and its strip marker is skipped, same defensive posture as the
  // rest of this V2X analysis section.
  timHitRoutePositions: Map<number, number> = new Map();
  preemptionHitRoutePositions: Map<string, number> = new Map();

  // ── Internal (non-observable) ─────────────────────────────────────────────
  private lastRerouteTime: number = 0;
  private lastOffRouteCheck: number = 0;
  // Timestamp the driver first read past OFF_ROUTE_THRESHOLD_M on this
  // excursion, or null while inside it — see checkOffRoute's hysteresis.
  private offRouteSinceMs: number | null = null;
  private _announcedKeys: Set<string> = new Set();
  private _alertedTimIds: Set<number> = new Set();
  // Distance (meters, from route start) at which each TIM hit's zone boundary
  // first crosses the route — lets checkTimZoneAlerts measure how far *ahead*
  // the user is from a zone instead of straight-line distance to its nearest
  // edge, which has no notion of direction of travel and can read as closest
  // on the far/exit side of an irregular zone.
  private _timEntryRouteLocationM: Map<number, number> = new Map();
  // Zones currently (or still lingering as) inside — the route-following
  // analog of TimService's activeInsideIds. No device heading is tracked
  // here, so "heading away" is approximated as "route position has passed
  // the zone's entry point" instead.
  private _insideZoneIds: Set<number> = new Set();

  constructor(private timService: TimService) {
    makeAutoObservable(this);
    reaction(
      () => this.timService.activeTims.length,
      () => { if (this.hasActiveRoute) this.analyzeTimIntersections(); },
    );
    this.loadRecentRoutes();
  }

  // ── Computed getters ──────────────────────────────────────────────────────

  get currentStep(): RouteStep | null {
    return this.steps[this.currentStepIndex] ?? null;
  }

  get nextStep(): RouteStep | null {
    return this.steps[this.currentStepIndex + 1] ?? null;
  }

  // The step after the upcoming maneuver — used for the "Then: ..." preview,
  // one further out than nextStep (the upcoming maneuver itself).
  get stepAfterNext(): RouteStep | null {
    return this.steps[this.currentStepIndex + 2] ?? null;
  }

  get distanceToManeuverFormatted(): string {
    const m = this.distanceToNextManeuver;
    if (!isFinite(m) || m <= 0) return '';
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft / 50) * 50 || 50} ft`;
    const mi = m / 1609.34;
    return `${mi.toFixed(1)} mi`;
  }

  get remainingDistanceFormatted(): string {
    const m = this.remainingDistanceM;
    if (m <= 0) return '';
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft)} ft`;
    const mi = m / 1609.34;
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }

  get remainingDurationFormatted(): string {
    const s = this.remainingDurationS;
    if (s <= 0) return '';
    if (s >= 3600) {
      const h = Math.floor(s / 3600);
      const m = Math.round((s % 3600) / 60);
      return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
    }
    const m = Math.round(s / 60);
    return m < 1 ? '< 1 min' : `${m} min`;
  }

  get estimatedArrivalTime(): string {
    if (this.remainingDurationS <= 0) return '';
    const arrival = new Date(Date.now() + this.remainingDurationS * 1000);
    return arrival.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }

  // ── Input / field actions ─────────────────────────────────────────────────

  setToText(text: string): void {
    this.toText = text;
    if (!text) {
      this.toCoord = null;
      this.toLabel = '';
    }
  }

  setShowSuggestions(show: boolean): void { this.showSuggestions = show; }
  clearSuggestions(): void { this.toSuggestions = []; this.showSuggestions = false; }
  setNavBannerHeightPx(height: number): void { this.navBannerHeightPx = height; }
  setTopHudExtraPx(height: number): void { this.topHudExtraPx = height; }

  selectToSuggestion(s: GeocodingSuggestion): void {
    this.toCoord = s.center;
    this.toLabel = s.placeName;
    this.toText = s.placeName;
    this.toSuggestions = [];
    this.showSuggestions = false;
  }

  // Same effect as selectToSuggestion, but from a previously-routed-to
  // destination — the user still reviews it on RouteScreen and taps "Get
  // Route" themselves, same as picking a fresh geocoding suggestion.
  selectRecentRoute(recent: RecentRoute): void {
    this.toCoord = recent.center;
    this.toLabel = recent.placeName;
    this.toText = recent.placeName;
    this.toSuggestions = [];
    this.showSuggestions = false;
  }

  setUserLocation(lngLat: [number, number]): void { this.userLocation = lngLat; }

  // ── Geocoding ─────────────────────────────────────────────────────────────

  async fetchGeocodingSuggestions(text: string): Promise<void> {
    if (text.length < 2) return;
    const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    try {
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
        `?proximity=${CHATT_PROXIMITY}&country=us&limit=5&access_token=${token}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      const suggestions: GeocodingSuggestion[] = (data.features ?? []).map((f: any) => ({
        id: f.id,
        placeName: f.place_name,
        center: f.center as [number, number],
      }));
      runInAction(() => {
        this.toSuggestions = suggestions;
        this.showSuggestions = suggestions.length > 0;
      });
    } catch {
      // Silent
    }
  }

  // ── Route fetching ────────────────────────────────────────────────────────

  async getRoute(): Promise<void> {
    if (!this.toCoord) return;
    if (!this.userLocation) {
      runInAction(() => { this.routeError = 'Waiting for GPS location…'; });
      return;
    }
    await this.fetchDirections(this.userLocation, this.toCoord);
  }

  clearRoute(): void {
    VoiceGuidanceService.stop();
    this.routeOptions = [];
    this.selectedRouteIndex = 0;
    this.routeCoordinates = [];
    this.remainingRouteCoordinates = [];
    this.routeDistance = '';
    this.routeDuration = '';
    this.isLoadingRoute = false;
    this.routeError = null;
    this.hasActiveRoute = false;
    this.isNavigating = false;
    this.isRerouting = false;
    this.lastRerouteTime = 0;
    this.offRouteSinceMs = null;
    // Step navigation
    this.steps = [];
    this.currentStepIndex = 0;
    this.distanceToNextManeuver = Infinity;
    this.remainingDistanceM = 0;
    this.remainingDurationS = 0;
    this.totalDurationS = 0;
    this.hasArrived = false;
    this.isOverviewMode = false;
    this._announcedKeys.clear();
    this._alertedTimIds.clear();
    this._insideZoneIds.clear();
    // V2X
    this.timHits = [];
    this.preemptionHits = [];
    this.approachingTimZones = [];
    this.approachingTimZoneDistancesM = new Map();
    this.insideTimZones = [];
    this.timHitRoutePositions = new Map();
    this.preemptionHitRoutePositions = new Map();
  }

  // Swaps in an alternate route the user tapped (chip or map line) during
  // preview. Mirrors the fields fetchDirections sets for the primary route,
  // then re-runs the V2X analysis against the newly active coordinates.
  selectRouteOption(index: number): void {
    if (index < 0 || index >= this.routeOptions.length || index === this.selectedRouteIndex) return;
    const option = this.routeOptions[index];

    this._announcedKeys.clear();
    this._alertedTimIds.clear();
    this._insideZoneIds.clear();

    runInAction(() => {
      this.selectedRouteIndex = index;
      this.applyRouteOption(option);
      this.hasArrived = false;
      this.approachingTimZones = [];
      this.approachingTimZoneDistancesM = new Map();
      this.insideTimZones = [];
    });

    this.analyzeTimIntersections();
    this.analyzePreemptionZones();
  }

  startNavigation(): void {
    if (!this.hasActiveRoute) return;
    this.isNavigating = true;
    this.hasArrived = false;
    this.currentStepIndex = 0;
    this._announcedKeys.clear();
    if (this.steps.length > 0) {
      this.announce(this.steps[0].instruction);
    }
  }

  toggleOverviewMode(): void {
    this.isOverviewMode = !this.isOverviewMode;
  }

  toggleVoiceGuidance(): void {
    this.voiceGuidanceEnabled = !this.voiceGuidanceEnabled;
    if (!this.voiceGuidanceEnabled) VoiceGuidanceService.stop();
  }

  private announce(text: string): void {
    if (this.voiceGuidanceEnabled) VoiceGuidanceService.announce(text);
  }

  // ── Navigation progress (called from MapView on every position update) ────

  updateProgress(userLngLat: [number, number]): void {
    // Step progress, arrival detection, and voice announcements are all
    // turn-by-turn concerns — gated on isNavigating, not just hasActiveRoute,
    // so a route preview (fetched but "Start Navigation" not yet tapped)
    // can't trigger them. Without this, a GPS update landing near the
    // destination — or a stale in-flight callback right as the screen swaps
    // from the preview map to the live-driving map — could fire arrival or
    // step-change speech before the user ever started navigating.
    if (!this.hasActiveRoute || !this.isNavigating || this.steps.length === 0 || this.hasArrived) return;

    try {
      const userPt = point(userLngLat);

      this.checkTimZoneAlerts(userPt);

      // Arrival: direct distance to destination — reliable regardless of step count/distances
      if (this.toCoord) {
        const distToDest = turfDistance(userPt, point(this.toCoord), { units: 'meters' });
        if (distToDest <= 30) {
          runInAction(() => {
            this.hasArrived = true;
            this.routeCoordinates = [];
            this.remainingRouteCoordinates = [];
          });
          this.announce('You have arrived at your destination');
          return;
        }
      }

      const routeLine = lineString(this.routeCoordinates);
      const snapped = nearestPointOnLine(routeLine, userPt, { units: 'meters' });

      // `location` is distance along the route line from the start to the snapped point
      const distTraveled = (snapped.properties.location as number) ?? 0;

      // Trim the traveled portion off the drawn route line as the user passes
      // it — only once actually navigating, so the full route still shows
      // during route preview/overview.
      const trimmedCoordinates: [number, number][] | null = this.isNavigating
        ? [
            snapped.geometry.coordinates as [number, number],
            ...this.routeCoordinates.slice((snapped.properties.index ?? 0) + 1),
          ]
        : null;

      // Find which step the user is currently in
      let cumDist = 0;
      let stepIdx = 0;
      for (let i = 0; i < this.steps.length; i++) {
        const stepEnd = cumDist + this.steps[i].distance;
        if (distTraveled < stepEnd || i === this.steps.length - 1) {
          stepIdx = i;
          break;
        }
        cumDist += this.steps[i].distance;
      }

      const distWithinStep = Math.max(0, distTraveled - cumDist);
      const distToManeuver = Math.max(0, this.steps[stepIdx].distance - distWithinStep);

      // Sum remaining distance across future steps
      let remainingM = distToManeuver;
      for (let i = stepIdx + 1; i < this.steps.length; i++) {
        remainingM += this.steps[i].distance;
      }

      // Remaining duration — proportional to distance remaining
      const totalM = this.steps.reduce((s, st) => s + st.distance, 0);
      const remainingS = totalM > 0 ? (remainingM / totalM) * this.totalDurationS : 0;

      // Announce step change — safety net announcing the upcoming maneuver
      // for the step we just entered (steps[stepIdx].maneuver already
      // happened; it's what put us on steps[stepIdx].name), in case a
      // distance-threshold tick got skipped, e.g. a GPS jump straight
      // across a step boundary.
      if (stepIdx !== this.currentStepIndex) {
        const upcoming = this.steps[stepIdx + 1];
        if (upcoming) {
          this.announce(upcoming.instruction);
        }
      }

      this.triggerVoiceGuidance(stepIdx, distToManeuver);

      runInAction(() => {
        this.currentStepIndex = stepIdx;
        this.distanceToNextManeuver = distToManeuver;
        this.remainingDistanceM = remainingM;
        this.remainingDurationS = remainingS;
        if (trimmedCoordinates) this.remainingRouteCoordinates = trimmedCoordinates;
      });
    } catch {
      // Silent — turf errors on edge-case geometry
    }
  }

  private triggerVoiceGuidance(stepIdx: number, distToManeuver: number): void {
    // distToManeuver counts down to the maneuver at the START of the NEXT
    // step — steps[stepIdx].maneuver already happened; it's what put us on
    // steps[stepIdx].name, the road we're currently driving. Falls back to
    // the current step only when there's no next one (final leg).
    const upcoming = this.steps[stepIdx + 1] ?? this.steps[stepIdx];
    if (!upcoming) return;

    for (const { dist, label } of VOICE_THRESHOLDS) {
      const key = `${stepIdx}-${label}`;
      if (distToManeuver <= dist && !this._announcedKeys.has(key)) {
        this._announcedKeys.add(key);
        const text = label === 'now'
          ? upcoming.instruction
          : `In ${label} meters, ${upcoming.instruction.toLowerCase()}`;
        this.announce(text);
        break;
      }
    }
  }

  // ── Off-route detection ───────────────────────────────────────────────────

  checkOffRoute(userLngLat: [number, number]): void {
    // Same reasoning as updateProgress — rerouting is a turn-by-turn concern,
    // not something a route preview should trigger.
    if (!this.hasActiveRoute || !this.isNavigating || this.routeCoordinates.length < 2) return;
    const now = Date.now();
    if (now - this.lastOffRouteCheck < OFF_ROUTE_CHECK_INTERVAL_MS) return;
    this.lastOffRouteCheck = now;
    if (now - this.lastRerouteTime < REROUTE_DEBOUNCE_MS) return;

    try {
      const userPt = point(userLngLat);
      const routeLine = lineString(this.routeCoordinates);
      const snapped = nearestPointOnLine(routeLine, userPt, { units: 'meters' });
      const dist = snapped.properties.dist ?? Infinity;

      if (dist <= OFF_ROUTE_THRESHOLD_M) {
        this.offRouteSinceMs = null;
        return;
      }

      // Still within OFF_ROUTE_CONFIRM_MS of first reading past the
      // threshold — could just be GPS jitter, wait for it to persist.
      if (this.offRouteSinceMs == null) {
        this.offRouteSinceMs = now;
        return;
      }
      if (now - this.offRouteSinceMs < OFF_ROUTE_CONFIRM_MS) return;

      if (this.toCoord) {
        this.offRouteSinceMs = null;
        this.lastRerouteTime = Date.now();
        this.announce('Recalculating route');
        runInAction(() => { this.isRerouting = true; });
        this.fetchDirections(userLngLat, this.toCoord).finally(() => {
          runInAction(() => { this.isRerouting = false; });
        });
      }
    } catch {
      // Silent
    }
  }

  // ── Camera bearing helper ─────────────────────────────────────────────────

  getRouteBearing(userLngLat: [number, number]): number | null {
    if (this.routeCoordinates.length < 2) return null;
    try {
      const userPt = point(userLngLat);
      const routeLine = lineString(this.routeCoordinates);
      const snapped = nearestPointOnLine(routeLine, userPt, { units: 'meters' });
      // Aim at a point ahead along the route rather than the nearest vertex —
      // vertex-to-vertex bearing is a step function that jumps at every
      // polyline joint, which snaps the nav camera's heading instead of
      // turning it smoothly through curves.
      const lookaheadPoint = along(routeLine, (snapped.properties.location ?? 0) + ROUTE_BEARING_LOOKAHEAD_METERS, { units: 'meters' });
      return bearing(snapped, lookaheadPoint);
    } catch {
      return null;
    }
  }

  // ── Private: fetch directions ─────────────────────────────────────────────

  private async fetchDirections(
    from: [number, number],
    to: [number, number],
  ): Promise<void> {
    const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;

    runInAction(() => {
      this.isLoadingRoute = true;
      this.routeError = null;
    });

    try {
      const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
        `?geometries=geojson&overview=full&steps=true&alternatives=true` +
        `&voice_instructions=true&banner_instructions=true` +
        `&access_token=${token}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Directions API ${resp.status}`);
      const data = await resp.json();

      const routes = data.routes ?? [];
      if (routes.length === 0) throw new Error('No route found');

      // Mapbox returns the recommended route first when alternatives=true.
      const options: RouteOption[] = routes.map((route: any) => this.buildRouteOption(route));

      this._announcedKeys.clear();
      this._alertedTimIds.clear();
      this._insideZoneIds.clear();

      runInAction(() => {
        this.routeOptions = options;
        this.selectedRouteIndex = 0;
        this.applyRouteOption(options[0]);
        this.hasActiveRoute = true;
        this.isLoadingRoute = false;
        this.hasArrived = false;
        this.isOverviewMode = false;
        this.approachingTimZones = [];
        this.approachingTimZoneDistancesM = new Map();
        this.insideTimZones = [];
      });

      this.analyzeTimIntersections();
      this.analyzePreemptionZones();
      this.addRecentRoute(this.toLabel || this.toText, to);
    } catch (err: any) {
      runInAction(() => {
        this.routeError = err?.message ?? 'Could not fetch route.';
        this.isLoadingRoute = false;
      });
    }
  }

  // Parses one Directions API route object into a self-contained RouteOption.
  private buildRouteOption(route: any): RouteOption {
    const coordinates: [number, number][] = route.geometry.coordinates;
    const distanceMi = (route.distance / 1609.34).toFixed(1);
    const durationMin = Math.round(route.duration / 60);

    const steps: RouteStep[] = [];
    for (const leg of route.legs ?? []) {
      for (const step of leg.steps ?? []) {
        steps.push({
          distance: step.distance ?? 0,
          duration: step.duration ?? 0,
          name: step.name ?? '',
          maneuverType: step.maneuver?.type ?? 'continue',
          maneuverModifier: step.maneuver?.modifier,
          instruction: step.maneuver?.instruction ?? step.name ?? '',
          coordinate: step.maneuver?.location ?? [0, 0],
        });
      }
    }

    return {
      coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      distanceLabel: `${distanceMi} mi`,
      durationLabel: `${durationMin} min`,
      steps,
    };
  }

  // Copies a RouteOption's fields into the active-route observables — shared
  // by fetchDirections (new route) and selectRouteOption (switching alternates).
  private applyRouteOption(option: RouteOption): void {
    this.routeCoordinates = option.coordinates;
    this.remainingRouteCoordinates = option.coordinates;
    this.routeDistance = option.distanceLabel;
    this.routeDuration = option.durationLabel;
    this.totalDurationS = option.durationSeconds;
    this.steps = option.steps;
    this.currentStepIndex = 0;
    this.distanceToNextManeuver = option.steps[0]?.distance ?? Infinity;
    this.remainingDistanceM = option.distanceMeters;
    this.remainingDurationS = option.durationSeconds;
  }

  // ── Private: V2X analysis ─────────────────────────────────────────────────

  private async analyzePreemptionZones(): Promise<void> {
    if (this.routeCoordinates.length < 2) return;
    try {
      const zones = SpatZoneService.getActiveZones();

      // The dashboard requires intersection_id per request, so query once per
      // distinct intersection along the route rather than a single global
      // call. Zones without a known intersectionId (e.g. the hardcoded
      // SPAT_ZONES fallback) can't be checked and are treated as unconfigured.
      const intersectionIds = Array.from(
        new Set(
          zones
            .map((z) => z.intersectionId)
            .filter((id): id is number => typeof id === 'number'),
        ),
      );
      const configLists = await Promise.all(
        intersectionIds.map((id) => PreemptionConfigService.fetchAllConfigs(id)),
      );
      const configs = configLists.filter((c): c is NonNullable<typeof c> => c !== null).flat();

      const configuredZoneIds = new Set(
        configs.filter(c => c.signalGroup !== null).map(c => c.spatZoneId),
      );
      const routeLine: Feature<LineString> = lineString(this.routeCoordinates);
      const routeLengthM = turfLength(routeLine, { units: 'meters' });
      const hits: PreemptionHit[] = [];
      const positions = new Map<string, number>();
      for (const zone of zones) {
        if (!configuredZoneIds.has(zone.id)) continue;
        try {
          const ring = [...zone.polygon] as [number, number][];
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
          if (ring.length < 4) continue;
          const zonePoly = polygon([ring]);
          if (!booleanIntersects(routeLine, zonePoly)) continue;

          // Earliest point (meters along the route) where routeLine crosses
          // a given line — used below for both the entry/exit boundaries and
          // the polygon-only fallback.
          const earliestCrossingM = (crossings: ReturnType<typeof lineIntersect>): number => {
            let best = Infinity;
            for (const crossing of crossings.features) {
              const loc = nearestPointOnLine(routeLine, crossing, { units: 'meters' }).properties.location;
              if (loc != null && loc < best) best = loc;
            }
            return best;
          };

          // A route can cross both a preemption zone's entry AND exit lines
          // while still travelling through it backwards relative to the
          // zone's intended direction (confirmed against real zone data —
          // e.g. a route that approaches from the far side crosses the exit
          // line, then later crosses the entry line, satisfying a naive
          // "did it cross the entry line at all" check while actually
          // entering through the exit). So it's not enough that the entry
          // line gets crossed — it must be crossed BEFORE the exit line
          // along the route's own direction of travel. entryLine/exitLine
          // are stored [lat, lng] (SpatZoneService's app-movement-tracking
          // convention — see its toLatLng); flip back to [lng, lat] to
          // intersect against routeLine with turf. Zones missing this data
          // fall back to the old polygon-only check rather than being
          // silently dropped.
          const hasEntry = !!zone.entryLine && zone.entryLine.length === 2;
          const hasExit = !!zone.exitLine && zone.exitLine.length === 2;
          const entryLocationM = hasEntry
            ? earliestCrossingM(lineIntersect(routeLine, lineString(zone.entryLine!.map(([lat, lng]) => [lng, lat]))))
            : Infinity;
          const exitLocationM = hasExit
            ? earliestCrossingM(lineIntersect(routeLine, lineString(zone.exitLine!.map(([lat, lng]) => [lng, lat]))))
            : Infinity;

          if (hasEntry && !isFinite(entryLocationM)) continue; // never crosses the entrance at all
          if (hasEntry && hasExit && isFinite(exitLocationM) && exitLocationM <= entryLocationM) continue; // exit reached first — backwards through the zone

          hits.push({ zoneId: zone.id, zoneName: zone.name, polygon: zone.polygon });

          // Same "where does the route first cross this zone" measurement
          // analyzeTimIntersections uses, expressed as a 0–1 fraction of the
          // route for the strip rather than raw meters (that's only needed
          // for the alert-lookahead math TIM zones use). Prefer the entry-line
          // crossing itself — the real "entering here" point — over the first
          // polygon-boundary crossing in general, which can land on the exit side.
          const finalEntryLocationM = isFinite(entryLocationM)
            ? entryLocationM
            : earliestCrossingM(lineIntersect(routeLine, zonePoly));
          if (isFinite(finalEntryLocationM) && routeLengthM > 0) {
            positions.set(zone.id, Math.min(1, Math.max(0, finalEntryLocationM / routeLengthM)));
          }
        } catch {
          // Skip malformed zone
        }
      }
      runInAction(() => { this.preemptionHits = hits; this.preemptionHitRoutePositions = positions; });
    } catch {
      // Silent
    }
  }

  private analyzeTimIntersections(): void {
    if (this.routeCoordinates.length < 2) return;
    try {
      const routeLine: Feature<LineString> = lineString(this.routeCoordinates);
      const routeLengthM = turfLength(routeLine, { units: 'meters' });
      const hits: TimHit[] = [];
      const entryLocations = new Map<number, number>();
      const positions = new Map<number, number>();
      for (const tim of this.timService.activeTims) {
        try {
          const poly = polygon(tim.geometry.coordinates);
          if (!booleanIntersects(routeLine, poly)) continue;
          hits.push({
            timId: tim.id,
            timType: tim.tim_type,
            category: tim.category,
            severity: tim.severity,
            description: tim.description,
            itisCodes: tim.itis_codes,
            validFrom: tim.valid_from,
            validUntil: tim.valid_until,
            geometry: tim.geometry,
          });

          // Where along the route the zone boundary is first crossed, so
          // checkTimZoneAlerts can measure distance ahead of the user rather
          // than straight-line distance to the nearest (possibly far-side) edge.
          const crossings = lineIntersect(routeLine, poly);
          let entryLocationM = Infinity;
          for (const crossing of crossings.features) {
            const loc = nearestPointOnLine(routeLine, crossing, { units: 'meters' }).properties.location;
            if (loc != null && loc < entryLocationM) entryLocationM = loc;
          }
          if (isFinite(entryLocationM)) {
            entryLocations.set(tim.id, entryLocationM);
            if (routeLengthM > 0) positions.set(tim.id, Math.min(1, Math.max(0, entryLocationM / routeLengthM)));
          }
        } catch {
          // Skip malformed TIM
        }
      }
      runInAction(() => {
        this.timHits = hits;
        this._timEntryRouteLocationM = entryLocations;
        this.timHitRoutePositions = positions;
      });
    } catch {
      // Silent
    }
  }

  // Only zones the active route actually crosses can alert. A zone logs once
  // (via triggerRouteAlert) the first time its entry point is within lookahead
  // range *ahead* of the user, and stays in `approachingTimZones` — driving the
  // persistent nav alert UI — until either it drops out of `timHits` (route no
  // longer crosses it) or the user enters it.
  //
  // Distance is measured along the route (userRouteLocation -> zone's entry
  // crossing), not straight-line to the nearest boundary point: a straight-line
  // distance has no notion of direction of travel, so for an irregular zone the
  // nearest edge can be on the far/exit side, making the alert fire only once
  // the user has already passed through.
  private checkTimZoneAlerts(userPt: Feature<Point>): void {
    const approaching: TimHit[] = [];
    const distances = new Map<number, number>();
    const insideNow: TimHit[] = [];

    if (this.routeCoordinates.length < 2) return;
    const routeLine: Feature<LineString> = lineString(this.routeCoordinates);
    const userRouteLocationM = nearestPointOnLine(routeLine, userPt, { units: 'meters' }).properties.location ?? 0;

    for (const hit of this.timHits) {
      try {
        const poly = polygon(hit.geometry.coordinates);
        const inside = booleanPointInPolygon(userPt, poly);

        // Route-following analog of TimService's "left the zone AND heading
        // away" dismiss rule: no device heading is available here, so once
        // inside, keep treating the zone as active until the user's route
        // position has actually passed its entry point (i.e. they've driven
        // past/through it), not merely the instant they exit the polygon.
        const entryLocationM = this._timEntryRouteLocationM.get(hit.timId);
        if (inside) {
          this._insideZoneIds.add(hit.timId);
          insideNow.push(hit);
        } else if (this._insideZoneIds.has(hit.timId)) {
          const hasPassed = entryLocationM == null || userRouteLocationM > entryLocationM;
          if (hasPassed) {
            this._insideZoneIds.delete(hit.timId);
          } else {
            insideNow.push(hit);
          }
        }

        let distanceAheadM: number | null = null;
        if (!inside) {
          if (entryLocationM == null) continue; // route never crosses into this zone from outside
          distanceAheadM = entryLocationM - userRouteLocationM;
          if (distanceAheadM < 0 || distanceAheadM > TIM_ALERT_LOOKAHEAD_M) continue;
        }

        if (!this._alertedTimIds.has(hit.timId)) {
          this._alertedTimIds.add(hit.timId);
          this.timService.triggerRouteAlert(hit);
        }
        if (!inside) {
          approaching.push(hit);
          distances.set(hit.timId, distanceAheadM as number);
        }
      } catch {
        // Skip malformed zone
      }
    }

    runInAction(() => {
      this.approachingTimZones = approaching;
      this.approachingTimZoneDistancesM = distances;
      this.insideTimZones = insideNow;
    });
  }

  // ── Private: recent routes persistence ────────────────────────────────────

  private async loadRecentRoutes(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(RECENT_ROUTES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      runInAction(() => { this.recentRoutes = parsed; });
    } catch {
      // Corrupt/unavailable storage — start with an empty list
    }
  }

  // Most-recent-first, deduped by destination coordinate (re-routing to an
  // already-recent place just moves it to the top instead of duplicating it).
  private addRecentRoute(placeName: string, center: [number, number]): void {
    if (!placeName) return;
    const deduped = this.recentRoutes.filter(
      (r) => r.center[0] !== center[0] || r.center[1] !== center[1],
    );
    const next = [{ id: `${center[0]},${center[1]}`, placeName, center }, ...deduped]
      .slice(0, MAX_RECENT_ROUTES);
    runInAction(() => { this.recentRoutes = next; });
    AsyncStorage.setItem(RECENT_ROUTES_STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Non-fatal — recents just won't persist across app restarts
    });
  }
}

export default RouteViewModel;
