import { makeObservable, observable, action, runInAction } from 'mobx';
import {
  point,
  polygon,
  buffer,
  booleanPointInPolygon,
  bearing,
  centroid,
  bbox,
} from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { API_CONFIG } from '../../../core/api/config';
import { normalizeToLngLat } from '../../../core/maps/coordinates';
import { TimMessage, timCategoryFromType } from '../models/TimTypes';

export interface TimToastItem {
  id: string;
  category: 'safety' | 'regulatory';
  message: string;
  timestamp: number;
}

export interface TimAlertLogItem {
  id: string;
  category: 'safety' | 'regulatory' | 'informational';
  message: string;
  timestamp: number;
  timId: number;
}

export class TimService {
  activeTims: TimMessage[] = [];
  toastQueue: TimToastItem[] = [];
  alertLog: TimAlertLogItem[] = [];
  unreadAlertCount: number = 0;

  private pollInterval: NodeJS.Timeout | null = null;
  private bufferedCache = new Map<number, Feature<Polygon | MultiPolygon>>();
  private inBufferIds = new Set<number>();

  constructor() {
    makeObservable(this, {
      activeTims: observable,
      toastQueue: observable,
      alertLog: observable,
      unreadAlertCount: observable,
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
    this.inBufferIds.clear();
    this.bufferedCache.clear();
    runInAction(() => {
      this.activeTims = [];
      this.toastQueue = [];
    });
  }

  dismissToast(id: string): void {
    this.toastQueue = this.toastQueue.filter((t) => t.id !== id);
  }

  clearUnreadCount(): void {
    this.unreadAlertCount = 0;
  }

  checkProximity(latitude: number, longitude: number, heading: number | null): void {
    if (!this.activeTims.length) return;

    const userPoint = point([longitude, latitude]);
    const nowInBuffer = new Set<number>();

    for (const tim of this.activeTims) {
      const bufferedGeom = this.bufferedCache.get(tim.id);
      if (!bufferedGeom) continue;

      const inBuffer = booleanPointInPolygon(userPoint, bufferedGeom);

      if (inBuffer) {
        nowInBuffer.add(tim.id);
        if (!this.inBufferIds.has(tim.id)) {
          const shouldAlert =
            heading === null ||
            !this.isCorridorZone(tim) ||
            this.isHeadingTowardZone(latitude, longitude, tim, heading);
          if (shouldAlert) {
            this.triggerAlert(tim);
          }
        }
      }
    }

    this.inBufferIds = nowInBuffer;
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

  private normalizeTimGeometry(tim: TimMessage): TimMessage {
    return {
      ...tim,
      geometry: {
        ...tim.geometry,
        coordinates: tim.geometry.coordinates.map((ring) =>
          ring.map((coordinate) => normalizeToLngLat(coordinate as [number, number])),
        ),
      },
    };
  }

  private triggerAlert(tim: TimMessage): void {
    const message = tim.description ?? `${tim.tim_type} ahead`;
    const id = `${tim.id}-${Date.now()}`;

    runInAction(() => {
      this.alertLog.unshift({
        id,
        category: tim.category,
        message,
        timestamp: Date.now(),
        timId: tim.id,
      });
      this.unreadAlertCount += 1;

      if (tim.category === 'safety' || tim.category === 'regulatory') {
        this.toastQueue.push({ id, category: tim.category as 'safety' | 'regulatory', message, timestamp: Date.now() });
      }
    });
  }

  private isCorridorZone(tim: TimMessage): boolean {
    try {
      const poly = polygon(tim.geometry.coordinates);
      const [minLng, minLat, maxLng, maxLat] = bbox(poly);
      const lngSpan = Math.abs(maxLng - minLng);
      const latSpan = Math.abs(maxLat - minLat);
      const minSpan = Math.min(lngSpan, latSpan);
      if (minSpan === 0) return false;
      return Math.max(lngSpan, latSpan) / minSpan > 1.5;
    } catch {
      return false;
    }
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
