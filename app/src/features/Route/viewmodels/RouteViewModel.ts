import { makeAutoObservable, reaction, runInAction } from 'mobx';
import {
  lineString,
  booleanIntersects,
  polygon,
  point,
  nearestPointOnLine,
  bearing,
} from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import { TimService } from '../../TIM/services/TimService';
import { TimCategory } from '../../TIM/models/TimTypes';
import { SpatZoneService } from '../../SpatService/services/SpatZoneService';
import { PreemptionConfigService } from '../../preemption/services/PreemptionConfigService';

export interface GeocodingSuggestion {
  id: string;
  placeName: string;
  center: [number, number]; // [lng, lat]
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

const CHATT_PROXIMITY = '-85.3099,35.0456'; // Chattanooga center — biases results, doesn't hard-exclude
const OFF_ROUTE_THRESHOLD_M = 30;
const REROUTE_DEBOUNCE_MS = 2_500;
const OFF_ROUTE_CHECK_INTERVAL_MS = 200;

export class RouteViewModel {
  toText: string = '';
  toSuggestions: GeocodingSuggestion[] = [];
  showSuggestions: boolean = false;

  toCoord: [number, number] | null = null;
  toLabel: string = '';

  userLocation: [number, number] | null = null;

  routeCoordinates: [number, number][] = [];
  routeDistance: string = '';
  routeDuration: string = '';
  isLoadingRoute: boolean = false;
  routeError: string | null = null;
  hasActiveRoute: boolean = false;
  isNavigating: boolean = false;

  timHits: TimHit[] = [];
  preemptionHits: PreemptionHit[] = [];
  isRerouting: boolean = false;

  private lastRerouteTime: number = 0;
  private lastOffRouteCheck: number = 0;

  constructor(private timService: TimService) {
    makeAutoObservable(this);
    // Re-analyze whenever TIM data refreshes while a route is active.
    // Handles the case where the route is fetched before the first TIM poll completes.
    reaction(
      () => this.timService.activeTims.length,
      () => { if (this.hasActiveRoute) this.analyzeTimIntersections(); },
    );
  }

  // ---------------------------------------------------------------------------
  // Input / field actions
  // ---------------------------------------------------------------------------

  setToText(text: string): void {
    this.toText = text;
    if (!text) {
      this.toCoord = null;
      this.toLabel = '';
    }
  }

  setShowSuggestions(show: boolean): void {
    this.showSuggestions = show;
  }

  clearSuggestions(): void {
    this.toSuggestions = [];
    this.showSuggestions = false;
  }

  selectToSuggestion(s: GeocodingSuggestion): void {
    this.toCoord = s.center;
    this.toLabel = s.placeName;
    this.toText = s.placeName;
    this.toSuggestions = [];
    this.showSuggestions = false;
  }

  setUserLocation(lngLat: [number, number]): void {
    this.userLocation = lngLat;
  }

  // ---------------------------------------------------------------------------
  // Geocoding
  // ---------------------------------------------------------------------------

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
      // Silent — network errors don't break the UI
    }
  }

  // ---------------------------------------------------------------------------
  // Route fetching
  // ---------------------------------------------------------------------------

  async getRoute(): Promise<void> {
    if (!this.toCoord) return;
    if (!this.userLocation) {
      runInAction(() => {
        this.routeError = 'Waiting for GPS location…';
      });
      return;
    }
    await this.fetchDirections(this.userLocation, this.toCoord);
  }

  clearRoute(): void {
    this.routeCoordinates = [];
    this.routeDistance = '';
    this.routeDuration = '';
    this.isLoadingRoute = false;
    this.routeError = null;
    this.hasActiveRoute = false;
    this.isNavigating = false;
    this.timHits = [];
    this.preemptionHits = [];
    this.isRerouting = false;
    this.lastRerouteTime = 0;
  }

  startNavigation(): void {
    if (this.hasActiveRoute) this.isNavigating = true;
  }

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

  // ---------------------------------------------------------------------------
  // Off-route detection (called by MainViewModel's 500 ms interval)
  // ---------------------------------------------------------------------------

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
        runInAction(() => { this.isRerouting = true; });
        this.fetchDirections(userLngLat, this.toCoord).finally(() => {
          runInAction(() => { this.isRerouting = false; });
        });
      }
    } catch {
      // Silent — turf errors on malformed geometry
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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
        `?geometries=geojson&overview=full&access_token=${token}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Directions API ${resp.status}`);
      const data = await resp.json();

      const route = data.routes?.[0];
      if (!route) throw new Error('No route found');

      const coordinates: [number, number][] = route.geometry.coordinates;
      const distanceMi = (route.distance / 1609.34).toFixed(1);
      const durationMin = Math.round(route.duration / 60);

      runInAction(() => {
        this.routeCoordinates = coordinates;
        this.routeDistance = `${distanceMi} mi`;
        this.routeDuration = `${durationMin} min`;
        this.hasActiveRoute = true;
        this.isLoadingRoute = false;
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

  private async analyzePreemptionZones(): Promise<void> {
    if (this.routeCoordinates.length < 2) return;

    try {
      const [configs, zones] = await Promise.all([
        PreemptionConfigService.fetchAllConfigs(),
        Promise.resolve(SpatZoneService.getActiveZones()),
      ]);

      // Build a set of spatZoneIds that have an active preemption config
      const configuredZoneIds = new Set(
        configs.filter(c => c.signalGroup !== null).map(c => c.spatZoneId),
      );

      const routeLine: Feature<LineString> = lineString(this.routeCoordinates);
      const hits: PreemptionHit[] = [];

      for (const zone of zones) {
        if (!configuredZoneIds.has(zone.id)) continue;
        try {
          // Ensure the ring is closed for turf
          const ring = [...zone.polygon] as [number, number][];
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
          if (ring.length < 4) continue;

          const zonePoly = polygon([ring]);
          if (booleanIntersects(routeLine, zonePoly)) {
            hits.push({ zoneId: zone.id, zoneName: zone.name });
          }
        } catch {
          // Skip malformed zone geometry
        }
      }

      runInAction(() => {
        this.preemptionHits = hits;
      });
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
          const timPoly = polygon(tim.geometry.coordinates);
          if (booleanIntersects(routeLine, timPoly)) {
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
          // Skip malformed TIM geometry
        }
      }

      runInAction(() => {
        this.timHits = hits;
      });
    } catch {
      // Silent
    }
  }
}

export default RouteViewModel;
