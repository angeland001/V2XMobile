import { makeObservable, observable, action, runInAction } from 'mobx';
import {
  point,
  polygon,
  buffer,
  booleanPointInPolygon,
  bearing,
  centroid,
  distance,
} from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { API_CONFIG } from '../../../core/api/config';
import { normalizeToLngLat, closeRing } from '../../../core/maps/coordinates';
import { TimMessage, TimHit, timCategoryFromType } from '../models/TimTypes';

export interface TimToastItem {
  id: string;
  category: 'safety' | 'regulatory' | 'informational';
  message: string;
  timestamp: number;
  timId: number;
  severity: number;
}

export interface TimAlertLogItem {
  id: string;
  category: 'safety' | 'regulatory' | 'informational';
  message: string;
  timestamp: number;
  timId: number;
  severity: number;
  timType: string;
  itisCodes: number[];
  validFrom: string | null;
  validUntil: string | null;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

export class TimService {
  activeTims: TimMessage[] = [];
  toastQueue: TimToastItem[] = [];
  alertLog: TimAlertLogItem[] = [];
  unreadAlertCount: number = 0;
  timDistances: Map<number, number> = new Map();

  private pollInterval: NodeJS.Timeout | null = null;
  private bufferedCache = new Map<number, Feature<Polygon | MultiPolygon>>();
  private alertedIds = new Set<number>();
  // False until the first checkProximity pass with real TIM data. That pass seeds
  // alertedIds for anything already in-buffer without alerting — so a zone that
  // was already "true" the moment monitoring started (e.g. at app boot) doesn't
  // fire, and only a genuine transition into a zone does.
  private hasSeededInitialProximity = false;

  constructor() {
    makeObservable(this, {
      activeTims: observable,
      toastQueue: observable,
      alertLog: observable,
      unreadAlertCount: observable,
      timDistances: observable,
      start: action,
      stop: action,
      checkProximity: action,
      dismissToast: action,
      clearUnreadCount: action,
    });
  }

  start(): void {
    if (this.pollInterval) return;
    this.fetchActiveTims();
    this.pollInterval = setInterval(() => this.fetchActiveTims(), 15_000);
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.alertedIds.clear();
    this.bufferedCache.clear();
    this.hasSeededInitialProximity = false;
    runInAction(() => {
      this.activeTims = [];
      this.toastQueue = [];
      this.timDistances = new Map();
    });
  }

  dismissToast(id: string): void {
    this.toastQueue = this.toastQueue.filter((t) => t.id !== id);
  }

  clearUnreadCount(): void {
    this.unreadAlertCount = 0;
  }

  // Ambient (non-navigating) proximity check: a zone only alerts once, while the
  // user is within its buffer AND actually heading toward it — not on buffer entry alone.
  checkProximity(latitude: number, longitude: number, heading: number | null): void {
    if (!this.activeTims.length) return;

    const userPoint = point([longitude, latitude]);
    const nowInBuffer = new Set<number>();
    const newDistances = new Map<number, number>();
    const isSeedPass = !this.hasSeededInitialProximity;
    this.hasSeededInitialProximity = true;

    for (const tim of this.activeTims) {
      try {
        const poly = polygon(tim.geometry.coordinates);
        const c = centroid(poly);
        const dist = distance(userPoint, c, { units: 'miles' });
        newDistances.set(tim.id, dist);
      } catch {}

      const bufferedGeom = this.bufferedCache.get(tim.id);
      if (!bufferedGeom) continue;

      const inBuffer = booleanPointInPolygon(userPoint, bufferedGeom);

      if (inBuffer) {
        nowInBuffer.add(tim.id);
        if (isSeedPass) {
          // Already inside the buffer the moment monitoring started — mark it
          // seen without alerting, don't treat "was already true" as an approach.
          this.alertedIds.add(tim.id);
        } else if (!this.alertedIds.has(tim.id)) {
          const shouldAlert =
            heading === null || this.isHeadingTowardZone(latitude, longitude, tim, heading);
          if (shouldAlert) {
            this.alertedIds.add(tim.id);
            this.triggerAlert(tim);
          }
        }
      } else {
        // Left the buffer — allow this zone to alert again on a future approach.
        this.alertedIds.delete(tim.id);
      }
    }

    this.timDistances = newDistances;
  }

  private async fetchActiveTims(): Promise<void> {
    try {
      const resp = await fetch(`${API_CONFIG.DASHBOARD_API_URL}/api/tim-messages`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (!Array.isArray(data)) return;

      const tims = (data as TimMessage[])
        .filter((tim) => tim.is_active)
        .map((tim) => {
          const category = timCategoryFromType(tim.tim_type);
          return this.normalizeTimGeometry({ ...tim, category });
        });
      const newCache = new Map<number, Feature<Polygon | MultiPolygon>>();

      for (const tim of tims) {
        try {
          const poly = polygon(tim.geometry.coordinates);
          const buf = buffer(poly, 0.5, { units: 'miles' });
          if (buf) newCache.set(tim.id, buf as Feature<Polygon | MultiPolygon>);
        } catch {
          // Skip malformed geometry
        }
      }

      runInAction(() => {
        this.activeTims = tims;
        this.bufferedCache = newCache;
      });
    } catch {
      // Silent — same pattern as SpatZoneService
    }
  }

  // Closes each ring here, at the point geometry enters the system, so every
  // consumer (buffer/intersection math in this file and in RouteViewModel) gets
  // a turf-valid polygon — the dashboard API doesn't guarantee closed rings, and
  // turf.polygon() throws (silently skipping the zone) on an unclosed one.
  private normalizeTimGeometry(tim: TimMessage): TimMessage {
    return {
      ...tim,
      geometry: {
        ...tim.geometry,
        coordinates: tim.geometry.coordinates.map((ring) =>
          closeRing(ring.map((coordinate) => normalizeToLngLat(coordinate as [number, number]))),
        ),
      },
    };
  }

  private triggerAlert(tim: TimMessage): void {
    this.pushAlert(
      {
        timId: tim.id,
        timType: tim.tim_type,
        category: tim.category,
        severity: tim.severity,
        description: tim.description,
        itisCodes: tim.itis_codes,
        validFrom: tim.valid_from,
        validUntil: tim.valid_until,
        geometry: tim.geometry,
      },
      { toast: true },
    );
  }

  // Called by RouteViewModel when the active navigation route crosses a TIM zone
  // and the user has come within its heads-up lookahead distance. Only logs the
  // alert — the persistent nav UI is driven by RouteViewModel.approachingTimZones,
  // not the ephemeral toast queue.
  triggerRouteAlert(hit: TimHit): void {
    this.pushAlert(hit, { toast: false });
  }

  private pushAlert(hit: TimHit, opts: { toast: boolean }): void {
    // `??` only falls back on null/undefined — the API can also send an empty
    // string for description, which would otherwise render as blank text.
    const message = hit.description || `${hit.timType} ahead`;
    const id = `${hit.timId}-${Date.now()}`;

    runInAction(() => {
      this.alertLog.unshift({
        id,
        category: hit.category,
        message,
        timestamp: Date.now(),
        timId: hit.timId,
        severity: hit.severity,
        timType: hit.timType,
        itisCodes: hit.itisCodes,
        validFrom: hit.validFrom,
        validUntil: hit.validUntil,
        geometry: hit.geometry,
      });
      this.unreadAlertCount += 1;

      if (opts.toast) {
        this.toastQueue.push({
          id,
          category: hit.category,
          message,
          timestamp: Date.now(),
          timId: hit.timId,
          severity: hit.severity,
        });
      }
    });
  }

  private isHeadingTowardZone(
    latitude: number,
    longitude: number,
    tim: TimMessage,
    deviceHeading: number,
  ): boolean {
    try {
      const userPt = point([longitude, latitude]);
      const poly = polygon(tim.geometry.coordinates);
      const zoneCentroid = centroid(poly);
      const rawBearing = bearing(userPt, zoneCentroid);
      const zoneBearing = (rawBearing + 360) % 360;
      return this.angularDiff(deviceHeading, zoneBearing) <= 90;
    } catch {
      return true;
    }
  }

  private angularDiff(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }
}

export default TimService;
