import { makeObservable, observable, action, runInAction } from 'mobx';
import { point, polygon, booleanPointInPolygon } from '@turf/turf';
import { API_CONFIG } from '../../../core/api/config';
import { normalizeToLngLat, closeRing } from '../../../core/maps/coordinates';
import { TimMessage, TimHit, TimCategory, timCategoryFromType } from '../models/TimTypes';

export interface NearbyTim {
  timId: number;
  timType: string;
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
  alertLog: TimAlertLogItem[] = [];
  unreadAlertCount: number = 0;
  // Nearest (highest-severity) zone per category the user is currently
  // physically inside — live/continuous, recomputed every checkProximity
  // tick. Drives both the Android Auto badge display and the in-app zone
  // banner: present only while inside a zone, gone the instant the user
  // exits it, and populated again on re-entry (see checkProximity).
  nearbyByCategory: NearbyByCategory = { safety: null, regulatory: null, informational: null };

  private pollInterval: NodeJS.Timeout | null = null;
  // Zones the user is currently inside — the only state checkProximity needs
  // to tell "just entered" (log a fresh alert) from "still inside" (no-op)
  // from "just left" (drop out of nearbyByCategory).
  private insideIds = new Set<number>();

  constructor() {
    makeObservable(this, {
      activeTims: observable,
      alertLog: observable,
      unreadAlertCount: observable,
      nearbyByCategory: observable,
      start: action,
      stop: action,
      checkProximity: action,
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
    this.insideIds.clear();
    runInAction(() => {
      this.activeTims = [];
      this.nearbyByCategory = { safety: null, regulatory: null, informational: null };
    });
  }

  clearUnreadCount(): void {
    this.unreadAlertCount = 0;
  }

  // Ambient (non-navigating) proximity check: a zone alerts exactly when the
  // user's position enters its polygon, and drops out of nearbyByCategory
  // the instant they exit it — no buffer, no heading, no lingering. Re-entry
  // (even of the same zone, later) alerts again since insideIds is cleared
  // on exit.
  checkProximity(latitude: number, longitude: number): void {
    if (!this.activeTims.length) return;

    const userPoint = point([longitude, latitude]);
    const nowInside = new Set<number>();
    const newNearby: NearbyByCategory = { safety: null, regulatory: null, informational: null };

    for (const tim of this.activeTims) {
      let isInside = false;
      try {
        isInside = booleanPointInPolygon(userPoint, polygon(tim.geometry.coordinates));
      } catch {
        continue; // Skip malformed geometry
      }
      if (!isInside) continue;

      nowInside.add(tim.id);
      if (!this.insideIds.has(tim.id)) {
        this.triggerAlert(tim);
      }

      const current = newNearby[tim.category];
      // Multiple overlapping zones of the same category: surface the more
      // severe one on the shared per-category slot.
      if (!current || tim.severity > current.severity) {
        newNearby[tim.category] = {
          timId: tim.id,
          timType: tim.tim_type,
          description: tim.description,
          severity: tim.severity,
          validUntil: tim.valid_until,
        };
      }
    }

    this.insideIds = nowInside;
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

      runInAction(() => {
        this.activeTims = tims;
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
    this.pushAlert({
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

  // Called by RouteViewModel when the active navigation route's user
  // position enters a TIM zone it crosses. Just logs the alert — the
  // persistent nav UI is driven directly by RouteViewModel.insideTimZones.
  triggerRouteAlert(hit: TimHit): void {
    this.pushAlert(hit);
  }

  private pushAlert(hit: TimHit): void {
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
    });
  }
}

export default TimService;
