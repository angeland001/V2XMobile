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
import { TimMessage, TimHit, TimCategory, timCategoryFromType } from '../models/TimTypes';

export interface NearbyTim {
  timId: number;
  timType: string;
  distanceMi: number;
  // True while the user is inside the zone's raw polygon, or was until they
  // left it without yet heading away — see activeInsideIds in checkProximity.
  inside: boolean;
  // Carried through so CarBridgeService can surface it on the Android Auto
  // badge — the API can send null/empty, same as TimHit.description.
  description: string | null;
  // Also carried through for CarBridgeService's severity numeral decoration.
  severity: number;
  // Carried through for CarBridgeService's Android Auto "active until" line —
  // same null-when-open-ended contract as TimMessage.valid_until.
  validUntil: string | null;
}

export type NearbyByCategory = Record<TimCategory, NearbyTim | null>;

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
  // Nearest zone per category the user is currently inside the buffer of AND
  // heading toward — live/continuous (unlike alertedIds below, which is a
  // one-shot "fired once" gate for the toast). Drives the Android Auto badge
  // display, which needs to reflect the current approach state, not a
  // single historical alert.
  nearbyByCategory: NearbyByCategory = { safety: null, regulatory: null, informational: null };

  private pollInterval: NodeJS.Timeout | null = null;
  private bufferedCache = new Map<number, Feature<Polygon | MultiPolygon>>();
  private alertedIds = new Set<number>();
  // Zones the user is currently inside, or was inside and hasn't yet both
  // left AND turned away from — see the dismiss rule in checkProximity.
  // Distinct from alertedIds, which only gates the one-shot toast.
  private activeInsideIds = new Set<number>();
  // False until primeIfNeeded's one-time seed pass has run — see there.
  private hasSeededInitialProximity = false;

  constructor() {
    makeObservable(this, {
      activeTims: observable,
      toastQueue: observable,
      alertLog: observable,
      unreadAlertCount: observable,
      timDistances: observable,
      nearbyByCategory: observable,
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
    this.activeInsideIds.clear();
    this.bufferedCache.clear();
    this.hasSeededInitialProximity = false;
    runInAction(() => {
      this.activeTims = [];
      this.toastQueue = [];
      this.timDistances = new Map();
      this.nearbyByCategory = { safety: null, regulatory: null, informational: null };
    });
  }

  dismissToast(id: string): void {
    this.toastQueue = this.toastQueue.filter((t) => t.id !== id);
  }

  clearUnreadCount(): void {
    this.unreadAlertCount = 0;
  }

  // One-time seed of alertedIds/activeInsideIds for whatever the user is
  // already inside the buffer of the moment real GPS + TIM data both exist —
  // called unconditionally (regardless of moving/navigating) so it reflects
  // actual app boot, not "wherever the first movement-gated checkProximity
  // call happened to land". Without this decoupling, a zone the user starts
  // near — but doesn't reach until well into the drive — got permanently
  // misclassified as "already seen at boot" and never alerted. No-ops after
  // the first successful pass (or forever if activeTims never loads).
  primeIfNeeded(latitude: number, longitude: number): void {
    if (this.hasSeededInitialProximity || !this.activeTims.length) return;
    this.hasSeededInitialProximity = true;

    const userPoint = point([longitude, latitude]);
    for (const tim of this.activeTims) {
      const bufferedGeom = this.bufferedCache.get(tim.id);
      if (!bufferedGeom || !booleanPointInPolygon(userPoint, bufferedGeom)) continue;
      this.alertedIds.add(tim.id);
      try {
        if (booleanPointInPolygon(userPoint, polygon(tim.geometry.coordinates))) {
          this.activeInsideIds.add(tim.id);
        }
      } catch {}
    }
  }

  // Ambient (non-navigating) proximity check: a zone only alerts once, while the
  // user is within its buffer AND actually heading toward it — not on buffer entry alone.
  checkProximity(latitude: number, longitude: number, heading: number | null): void {
    if (!this.activeTims.length) return;
    this.primeIfNeeded(latitude, longitude);

    const userPoint = point([longitude, latitude]);
    const nowInBuffer = new Set<number>();
    const newDistances = new Map<number, number>();
    const newNearby: NearbyByCategory = { safety: null, regulatory: null, informational: null };

    for (const tim of this.activeTims) {
      let distMi: number | undefined;
      try {
        const poly = polygon(tim.geometry.coordinates);
        const c = centroid(poly);
        distMi = distance(userPoint, c, { units: 'miles' });
        newDistances.set(tim.id, distMi);
      } catch {}

      const bufferedGeom = this.bufferedCache.get(tim.id);
      if (!bufferedGeom) continue;

      const inBuffer = booleanPointInPolygon(userPoint, bufferedGeom);

      if (inBuffer) {
        nowInBuffer.add(tim.id);
        const headingOk = heading === null || this.isHeadingTowardZone(latitude, longitude, tim, heading);

        // "Inside" the zone itself (not just its 0.5mi buffer). Once inside,
        // keep reporting inside:true after the user exits the polygon until
        // they're ALSO no longer heading toward it — leaving the zone while
        // still travelling through/toward it (boundary jitter, a large zone)
        // shouldn't flip the badge off and on. Only left+heading-away dismisses it.
        let poly: Feature<Polygon> | undefined;
        try {
          poly = polygon(tim.geometry.coordinates);
        } catch {}
        const insideZone = poly != null && booleanPointInPolygon(userPoint, poly);
        if (insideZone) {
          this.activeInsideIds.add(tim.id);
        } else if (this.activeInsideIds.has(tim.id) && !headingOk) {
          this.activeInsideIds.delete(tim.id);
        }

        if (!this.alertedIds.has(tim.id) && headingOk) {
          this.alertedIds.add(tim.id);
          this.triggerAlert(tim);
        }

        const isInside = this.activeInsideIds.has(tim.id);
        if ((headingOk || isInside) && distMi != null) {
          const current = newNearby[tim.category];
          // Prefer an inside zone over a merely-approaching one — "you're in
          // it" always outranks a further-off approach for the same category.
          if (!current || (isInside && !current.inside) || (isInside === current.inside && distMi < current.distanceMi)) {
            newNearby[tim.category] = { timId: tim.id, timType: tim.tim_type, distanceMi: distMi, inside: isInside, description: tim.description, severity: tim.severity, validUntil: tim.valid_until };
          }
        }
      } else {
        // Left the buffer entirely — unconditional exit regardless of heading.
        this.alertedIds.delete(tim.id);
        this.activeInsideIds.delete(tim.id);
      }
    }

    this.timDistances = newDistances;
    this.nearbyByCategory = newNearby;
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
