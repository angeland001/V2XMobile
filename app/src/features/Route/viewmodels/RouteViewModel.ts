import { makeAutoObservable, reaction, runInAction } from 'mobx';
import {
  lineString,
  booleanIntersects,
  polygon,
  point,
  nearestPointOnLine,
  bearing,
  distance as turfDistance,
} from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import { TimService } from '../../TIM/services/TimService';
import { TimCategory } from '../../TIM/models/TimTypes';
import { SpatZoneService } from '../../SpatService/services/SpatZoneService';
import { PreemptionConfigService } from '../../preemption/services/PreemptionConfigService';
import { VoiceGuidanceService } from '../services/VoiceGuidanceService';

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

export interface TimHit {
  timId: number;
  timType: string;
  category: TimCategory;
  severity: number;
  description: string | null;
  itisCodes: number[];
  validFrom: string | null;
  validUntil: string | null;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

export interface PreemptionHit {
  zoneId: string;
  zoneName: string;
}

const CHATT_PROXIMITY = '-85.3099,35.0456';
const OFF_ROUTE_THRESHOLD_M = 30;
const REROUTE_DEBOUNCE_MS = 2_500;
const OFF_ROUTE_CHECK_INTERVAL_MS = 200;

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

  // ── V2X analysis ──────────────────────────────────────────────────────────
  timHits: TimHit[] = [];
  preemptionHits: PreemptionHit[] = [];

  // ── Internal (non-observable) ─────────────────────────────────────────────
  private lastRerouteTime: number = 0;
  private lastOffRouteCheck: number = 0;
  private _announcedKeys: Set<string> = new Set();

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
    // V2X
    this.timHits = [];
    this.preemptionHits = [];
  }

  startNavigation(): void {
    if (!this.hasActiveRoute) return;
    this.isNavigating = true;
    this.hasArrived = false;
    this.currentStepIndex = 0;
    this._announcedKeys.clear();
    if (this.steps.length > 0) {
      VoiceGuidanceService.announce(this.steps[0].instruction);
    }
  }

  toggleOverviewMode(): void {
    this.isOverviewMode = !this.isOverviewMode;
  }

  // ── Navigation progress (called from MapView on every position update) ────

  updateProgress(userLngLat: [number, number]): void {
    if (!this.hasActiveRoute || this.steps.length === 0 || this.hasArrived) return;

    try {
      const userPt = point(userLngLat);

      // Arrival: direct distance to destination — reliable regardless of step count/distances
      if (this.toCoord) {
        const distToDest = turfDistance(userPt, point(this.toCoord), { units: 'meters' });
        if (distToDest <= 30) {
          runInAction(() => {
            this.hasArrived = true;
            this.routeCoordinates = [];
          });
          VoiceGuidanceService.announce('You have arrived at your destination');
          return;
        }
      }

      const routeLine = lineString(this.routeCoordinates);
      const snapped = nearestPointOnLine(routeLine, userPt, { units: 'meters' });

      // `location` is distance along the route line from the start to the snapped point
      const distTraveled = (snapped.properties.location as number) ?? 0;

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

      // Announce step change
      if (stepIdx !== this.currentStepIndex) {
        const upcoming = this.steps[stepIdx];
        if (upcoming && upcoming.maneuverType !== 'depart') {
          VoiceGuidanceService.announce(upcoming.instruction);
        }
      }

      this.triggerVoiceGuidance(stepIdx, distToManeuver);

      runInAction(() => {
        this.currentStepIndex = stepIdx;
        this.distanceToNextManeuver = distToManeuver;
        this.remainingDistanceM = remainingM;
        this.remainingDurationS = remainingS;
      });
    } catch {
      // Silent — turf errors on edge-case geometry
    }
  }

  private triggerVoiceGuidance(stepIdx: number, distToManeuver: number): void {
    const step = this.steps[stepIdx];
    if (!step || step.maneuverType === 'depart') return;

    for (const { dist, label } of VOICE_THRESHOLDS) {
      const key = `${stepIdx}-${label}`;
      if (distToManeuver <= dist && !this._announcedKeys.has(key)) {
        this._announcedKeys.add(key);
        const text = label === 'now'
          ? step.instruction
          : `In ${label} meters, ${step.instruction.toLowerCase()}`;
        VoiceGuidanceService.announce(text);
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
        VoiceGuidanceService.announce('Recalculating route');
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
      const idx = snapped.properties.index ?? 0;
      const nextIdx = Math.min(idx + 1, this.routeCoordinates.length - 1);
      return bearing(point(this.routeCoordinates[idx]), point(this.routeCoordinates[nextIdx]));
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

      runInAction(() => {
        this.routeCoordinates = coordinates;
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
      const [configs, zones] = await Promise.all([
        PreemptionConfigService.fetchAllConfigs(),
        Promise.resolve(SpatZoneService.getActiveZones()),
      ]);
      const configuredZoneIds = new Set(
        (configs ?? []).filter(c => c.signalGroup !== null).map(c => c.spatZoneId),
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
      for (const tim of this.timService.activeTims) {
        try {
          if (booleanIntersects(routeLine, polygon(tim.geometry.coordinates))) {
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
          }
        } catch {
          // Skip malformed TIM
        }
      }
      runInAction(() => { this.timHits = hits; });
    } catch {
      // Silent
    }
  }
}

export default RouteViewModel;
