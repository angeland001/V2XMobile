import { makeAutoObservable, reaction, runInAction } from 'mobx';
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
  distance as turfDistance,
} from '@turf/turf';
import type { Feature, LineString, Point } from 'geojson';
import { TimService } from '../../TIM/services/TimService';
import { TimHit } from '../../TIM/models/TimTypes';
import { SpatZoneService } from '../../SpatService/services/SpatZoneService';
import { PreemptionConfigService } from '../../preemption/services/PreemptionConfigService';
import { VoiceGuidanceService } from '../services/VoiceGuidanceService';

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
}

const CHATT_PROXIMITY = '-85.3099,35.0456';
const OFF_ROUTE_THRESHOLD_M = 30;
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

  // ── Route overview ────────────────────────────────────────────────────────
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

  // ── Internal (non-observable) ─────────────────────────────────────────────
  private lastRerouteTime: number = 0;
  private lastOffRouteCheck: number = 0;
  private _announcedKeys: Set<string> = new Set();
  private _alertedTimIds: Set<number> = new Set();
  // Distance (meters, from route start) at which each TIM hit's zone boundary
  // first crosses the route — lets checkTimZoneAlerts measure how far *ahead*
  // the user is from a zone instead of straight-line distance to its nearest
  // edge, which has no notion of direction of travel and can read as closest
  // on the far/exit side of an irregular zone.
  private _timEntryRouteLocationM: Map<number, number> = new Map();

  constructor(private timService: TimService) {
    makeAutoObservable(this);
    reaction(
      () => this.timService.activeTims.length,
      () => { if (this.hasActiveRoute) this.analyzeTimIntersections(); },
    );
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
    // V2X
    this.timHits = [];
    this.preemptionHits = [];
    this.approachingTimZones = [];
    this.approachingTimZoneDistancesM = new Map();
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
    if (!this.hasActiveRoute || this.steps.length === 0 || this.hasArrived) return;

    try {
      const userPt = point(userLngLat);

      if (this.isNavigating) this.checkTimZoneAlerts(userPt);

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
    if (!this.hasActiveRoute || this.routeCoordinates.length < 2) return;
    const now = Date.now();
    if (now - this.lastOffRouteCheck < OFF_ROUTE_CHECK_INTERVAL_MS) return;
    this.lastOffRouteCheck = now;
    if (now - this.lastRerouteTime < REROUTE_DEBOUNCE_MS) return;

    try {
      const userPt = point(userLngLat);
      const routeLine = lineString(this.routeCoordinates);
      const snapped = nearestPointOnLine(routeLine, userPt, { units: 'meters' });
      const dist = snapped.properties.dist ?? Infinity;

      if (dist > OFF_ROUTE_THRESHOLD_M && this.toCoord) {
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
        `?geometries=geojson&overview=full&steps=true` +
        `&voice_instructions=true&banner_instructions=true` +
        `&access_token=${token}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Directions API ${resp.status}`);
      const data = await resp.json();

      const route = data.routes?.[0];
      if (!route) throw new Error('No route found');

      const coordinates: [number, number][] = route.geometry.coordinates;
      const distanceMi = (route.distance / 1609.34).toFixed(1);
      const durationMin = Math.round(route.duration / 60);

      // Parse all steps from all legs
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

      this._announcedKeys.clear();
      this._alertedTimIds.clear();

      runInAction(() => {
        this.routeCoordinates = coordinates;
        this.remainingRouteCoordinates = coordinates;
        this.routeDistance = `${distanceMi} mi`;
        this.routeDuration = `${durationMin} min`;
        this.totalDurationS = route.duration;
        this.steps = steps;
        this.hasActiveRoute = true;
        this.isLoadingRoute = false;
        this.hasArrived = false;
        this.currentStepIndex = 0;
        this.distanceToNextManeuver = steps[0]?.distance ?? Infinity;
        this.remainingDistanceM = route.distance;
        this.remainingDurationS = route.duration;
        this.isOverviewMode = false;
        this.approachingTimZones = [];
        this.approachingTimZoneDistancesM = new Map();
      });

      this.analyzeTimIntersections();
      this.analyzePreemptionZones();
    } catch (err: any) {
      runInAction(() => {
        this.routeError = err?.message ?? 'Could not fetch route.';
        this.isLoadingRoute = false;
      });
    }
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
      const hits: PreemptionHit[] = [];
      for (const zone of zones) {
        if (!configuredZoneIds.has(zone.id)) continue;
        try {
          const ring = [...zone.polygon] as [number, number][];
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
          if (ring.length < 4) continue;
          if (booleanIntersects(routeLine, polygon([ring]))) {
            hits.push({ zoneId: zone.id, zoneName: zone.name });
          }
        } catch {
          // Skip malformed zone
        }
      }
      runInAction(() => { this.preemptionHits = hits; });
    } catch {
      // Silent
    }
  }

  private analyzeTimIntersections(): void {
    if (this.routeCoordinates.length < 2) return;
    try {
      const routeLine: Feature<LineString> = lineString(this.routeCoordinates);
      const hits: TimHit[] = [];
      const entryLocations = new Map<number, number>();
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
          if (isFinite(entryLocationM)) entryLocations.set(tim.id, entryLocationM);
        } catch {
          // Skip malformed TIM
        }
      }
      runInAction(() => { this.timHits = hits; this._timEntryRouteLocationM = entryLocations; });
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

    if (this.routeCoordinates.length < 2) return;
    const routeLine: Feature<LineString> = lineString(this.routeCoordinates);
    const userRouteLocationM = nearestPointOnLine(routeLine, userPt, { units: 'meters' }).properties.location ?? 0;

    for (const hit of this.timHits) {
      try {
        const poly = polygon(hit.geometry.coordinates);
        const inside = booleanPointInPolygon(userPt, poly);

        let distanceAheadM: number | null = null;
        if (!inside) {
          const entryLocationM = this._timEntryRouteLocationM.get(hit.timId);
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
    });
  }
}

export default RouteViewModel;
