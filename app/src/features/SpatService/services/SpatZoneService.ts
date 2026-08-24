// app/src/features/SpatService/services/SpatZoneService.ts

import { point, polygon as turfPolygon, centroid, distance, bearing } from '@turf/turf';
import { API_CONFIG } from '../../../core/api/config';
import { closeRing, normalizeToLngLat } from '../../../core/maps/coordinates';

export interface SpatZone {
  id: string;
  name: string;
  polygon: [number, number][];
  laneIds: number[];
  signalGroup: number;
  // The intersection this zone belongs to, used to look up live SPaT data via
  // SpatWebSocketService's fuzzy match against the spat-events stream (which
  // covers all CUIP-instrumented corridor intersections, not just two). null
  // only when the zone has no name to key off of at all — a resolved name that
  // simply never matches live traffic (e.g. a bench/lab test controller) is
  // expected and surfaces as "SPaT unavailable" rather than borrowing another
  // intersection's feed.
  intersectionName: string | null;
  // Numeric intersection id from the dashboard, needed to query
  // preemption-zone-configs (which requires intersection_id per request).
  // undefined for the hardcoded SPAT_ZONES fallback, which predates this field.
  intersectionId?: number;
  entryLine?: [number, number][]; // Line user crosses to enter zone
  exitLine?: [number, number][]; // Line user crosses to exit zone
}


interface DashboardSpatZoneApiResponse {
  id: number;
  name: string;
  lane_ids: number[];
  signal_group: number;
  intersection_id: number;
  polygon: { type: 'Polygon'; coordinates: [number, number][][] };
  entry_line: { type: 'LineString'; coordinates: [number, number][] };
  exit_line: { type: 'LineString'; coordinates: [number, number][] };
  // Not confirmed present on this endpoint (only observed on the separate
  // preemption-zone-configs endpoint so far) — used when available, since it's
  // a more reliable intersection identity than the zone's own approach name.
  intersection_name?: string;
}

export const SPAT_ZONES: SpatZone[] = [
  {
    id: 'georgia_lanes_4_5',
    name: 'Georgia Lanes 4 & 5',
    polygon: [
    [-85.30818819724583, 35.04581087515382],
      [-85.3078772725392, 35.045701327254704],
      [-85.30798530743753, 35.04564597038842],
      [-85.30821557668192, 35.04573220847037],
      [-85.30818819724583, 35.04581087515382],
    ],
    laneIds: [4, 5],
    signalGroup: 2,
    // Must be the exact CUIP corridor slug, not a fuzzy fragment — the bridge
    // filters each connection's subscription by exact string match server-side.
    intersectionName: 'MLK_Georgia',
    entryLine: [
      [35.045701327254704, -85.3078772725392],
      [35.04564597038842, -85.30798530743753]
    ],
    exitLine: [
      [35.04581087515382, -85.30818819724583],
      [35.04573220847037, -85.30821557668192]
    ]
  },
  {
    id: 'georgia_lane_1',
    name: 'Georgia Lane 1',
    polygon: [
  [-85.30828953861565, 35.04585035701702],
      [-85.3081953147176, 35.04581536599744],
      [-85.30813483909343, 35.045932689327415],
      [-85.30823562301588, 35.04595040716744],
      [-85.30828953861565, 35.04585035701702],
    ],
    laneIds: [1],
    signalGroup: 4,
    // Must be the exact CUIP corridor slug, not a fuzzy fragment — the bridge
    // filters each connection's subscription by exact string match server-side.
    intersectionName: 'MLK_Georgia',
    entryLine: [
      [35.045932689327415, -85.30813483909343],
      [35.04595040716744, -85.30823562301588]
    ],
    exitLine: [
      [35.04585035701702, -85.30828953861565],
      [35.04581536599744, -85.3081953147176]
    ]
  },
  {
    id: 'georgia_lane_8',
    name: 'Georgia Lane 8',
    polygon: [
    [-85.30833844397954, 35.04574351301403],
    [-85.30850998193206, 35.045427179358015],
    [-85.30841874813754, 35.045407857101765],
    [-85.30826329917411, 35.045712107167205],
    [-85.30833844397954, 35.04574351301403]
    ],
    laneIds: [8],
    signalGroup: 4,
    // Must be the exact CUIP corridor slug, not a fuzzy fragment — the bridge
    // filters each connection's subscription by exact string match server-side.
    intersectionName: 'MLK_Georgia',
    entryLine: [
      [35.04574351301403, -85.30833844397954],
      [35.045712107167205, -85.30826329917411]
    ],
    exitLine: [
      [35.045427179358015, -85.30850998193206],
      [35.045407857101765, -85.30841874813754]
    ]
  },
  {
    id: 'georgia_lanes_10_11',
    name: 'Georgia Lanes 10 & 11',
    polygon: [
      [-85.30829194058872, 35.04587339197049],
      [-85.30890288513018, 35.04586380929149],
      [-85.30887736136788, 35.04566781438929],
      [-85.30843958685064, 35.045593068732515],
      [-85.30829194058872, 35.04587339197049],
    ],
    laneIds: [10, 11],
    signalGroup: 2,
    // Must be the exact CUIP corridor slug, not a fuzzy fragment — the bridge
    // filters each connection's subscription by exact string match server-side.
    intersectionName: 'MLK_Georgia',
    entryLine: [
      [35.04586380929149, -85.30890288513018],
      [35.04566781438929, -85.30887736136788]
    ],
    exitLine: [
      [35.04587339197049, -85.30829194058872],
      [35.045593068732515, -85.30843958685064]
    ]
  }
];

interface DashboardIntersectionApiResponse {
  intersection_id: number;
  // The intersection's identifier in CUIP's own corridor configuration (e.g.
  // "MLK_Houston") — null for intersections CUIP doesn't carry on its
  // spat-events stream at all (lab/bench controllers, drafts not yet wired
  // up). Authoritative for SpatWebSocketService matching; the zone's own
  // display `name` (often a turn instruction like "Continue Straight on MLK
  // East Entrance") is not a reliable stand-in and is no longer used as a
  // fallback for it.
  cuip_slug: string | null;
}

export class SpatZoneService {
  private static zoneCache: Map<string, boolean> = new Map();
  private static dashboardZones: SpatZone[] = [];
  private static intersectionSlugs: Map<number, string | null> = new Map();

  private static toLatLng(coord: [number, number]): [number, number] {
    // Dashboard/GeoJSON is [lng, lat], app movement tracking uses [lat, lng].
    return [coord[1], coord[0]];
  }

  private static async loadIntersectionSlugs(): Promise<void> {
    try {
      const endpoint = `${API_CONFIG.DASHBOARD_API_URL}/api/intersections`;
      const response = await fetch(endpoint, { method: 'GET' });
      if (!response.ok) {
        console.log(`[SPAT] Dashboard intersections fetch failed: ${response.status}`);
        return;
      }

      const data: DashboardIntersectionApiResponse[] = await response.json();
      if (!Array.isArray(data)) {
        console.log('[SPAT] Dashboard intersections fetch returned non-array payload');
        return;
      }

      this.intersectionSlugs = new Map(
        data.map((i) => [i.intersection_id, i.cuip_slug ?? null]),
      );
    } catch (error) {
      console.log('[SPAT] Dashboard intersections fetch error:', error);
    }
  }

  // Resolves the CUIP-authoritative match key for a zone's intersection.
  // Returns null when the intersection has no cuip_slug — meaning CUIP
  // doesn't carry this intersection on its spat-events stream at all (e.g. a
  // lab/bench controller), as opposed to a real corridor intersection that
  // simply has no live message right now. That distinction is what lets
  // SpatViewModel tell "never going to have coverage" apart from "should have
  // coverage but doesn't right now" (see SpatViewModel.hasCuipCoverage).
  //
  // cuip_slug takes priority: it's confirmed to match the live stream's
  // intersection field exactly (e.g. "MLK_Houston"), which matters now that
  // SpatWebSocketService sends it as an exact-match subscription filter to
  // the bridge — an imprecise value here means zero data, not a degraded
  // fuzzy match. z.intersection_name's format is unconfirmed, so it's only a
  // fallback for intersections not yet in the dashboard's intersections table.
  private static resolveIntersectionName(z: DashboardSpatZoneApiResponse): string | null {
    const slug = typeof z.intersection_id === 'number' ? this.intersectionSlugs.get(z.intersection_id) : null;
    if (slug && slug.trim()) return slug.trim();
    if (z.intersection_name && z.intersection_name.trim()) return z.intersection_name.trim();
    return null;
  }

  static async loadZonesFromDashboard(): Promise<void> {
    try {
      const [zonesResponse] = await Promise.all([
        fetch(`${API_CONFIG.DASHBOARD_API_URL}/api/spat-zones`, { method: 'GET' }),
        this.loadIntersectionSlugs(),
      ]);
      if (!zonesResponse.ok) {
        console.log(`[SPAT] Dashboard zone fetch failed: ${zonesResponse.status}`);
        return;
      }

      const data: DashboardSpatZoneApiResponse[] = await zonesResponse.json();
      if (!Array.isArray(data)) {
        console.log('[SPAT] Dashboard zone fetch returned non-array payload');
        return;
      }

      this.dashboardZones = data
        .filter((z) => z?.polygon?.coordinates?.[0]?.length >= 4 && z?.entry_line?.coordinates?.length === 2 && z?.exit_line?.coordinates?.length === 2)
        .map((z) => ({
          id: String(z.id),
          name: z.name,
          polygon: z.polygon.coordinates[0],
          laneIds: Array.isArray(z.lane_ids) ? z.lane_ids : [],
          signalGroup: z.signal_group,
          intersectionId: typeof z.intersection_id === 'number' ? z.intersection_id : undefined,
          intersectionName: this.resolveIntersectionName(z),
          entryLine: z.entry_line.coordinates.map((c) => this.toLatLng(c as [number, number])) as [number, number][],
          exitLine: z.exit_line.coordinates.map((c) => this.toLatLng(c as [number, number])) as [number, number][],
        }));

      console.log(`[SPAT] Loaded ${this.dashboardZones.length} zone(s) from dashboard API`);
    } catch (error) {
      console.log('[SPAT] Dashboard zone fetch error:', error);
    }
  }

  static getActiveZones(): SpatZone[] {
    return this.dashboardZones.length > 0 ? this.dashboardZones : SPAT_ZONES;
  }


  static findZoneForPosition(
    userPosition: [number, number],
    preferredZoneIds?: string[],
  ): SpatZone | null {
    if (!userPosition || userPosition[0] === 0 || userPosition[1] === 0) {
      return null;
    }

    const zones = this.getActiveZones();

    if (preferredZoneIds && preferredZoneIds.length > 0) {
      const preferredSet = new Set(preferredZoneIds);
      const ordered = [
        ...zones.filter((z) => preferredSet.has(z.id)),
        ...zones.filter((z) => !preferredSet.has(z.id)),
      ];
      for (const zone of ordered) {
        if (this.isPointInZone(userPosition, zone)) {
          return zone;
        }
      }
      return null;
    }

    for (const zone of zones) {
      if (this.isPointInZone(userPosition, zone)) {
        return zone;
      }
    }

    return null;
  }

  static findZoneById(zoneId: string): SpatZone | null {
    return this.getActiveZones().find(zone => zone.id === zoneId) || null;
  }

  // Nearest zone (other than the one the caller says the user is already
  // in) that's both within maxDistanceMi and roughly ahead of the user —
  // display-only, for calling out which of several nearby/overlapping zones
  // on the map the user is approaching. Mirrors TimService's own
  // buffer+heading proximity logic so both features read the same way to a
  // driver; does not feed preemption trigger logic (PreemptionViewModel has
  // its own debounced entry/exit detection, independent of this).
  static findApproachingZone(
    userPosition: [number, number],
    heading: number | null,
    excludeZoneId: string | null,
    maxDistanceMi: number = 0.3,
  ): SpatZone | null {
    if (!userPosition || userPosition[0] === 0 || userPosition[1] === 0) return null;

    const userPt = point([userPosition[1], userPosition[0]]);
    let best: { zone: SpatZone; distanceMi: number } | null = null;

    for (const zone of this.getActiveZones()) {
      if (zone.id === excludeZoneId) continue;
      if (this.isPointInZone(userPosition, zone)) continue; // already inside — not "approaching"

      try {
        const poly = turfPolygon([closeRing(zone.polygon)]);
        const zoneCentroid = centroid(poly);
        const distanceMi = distance(userPt, zoneCentroid, { units: 'miles' });
        if (distanceMi > maxDistanceMi) continue;

        if (heading !== null) {
          const zoneBearing = (bearing(userPt, zoneCentroid) + 360) % 360;
          const diff = Math.abs(heading - zoneBearing) % 360;
          if ((diff > 180 ? 360 - diff : diff) > 90) continue;
        }

        // Only "approaching" if the user is nearer the zone's entry side
        // than its exit side — otherwise a zone can light up purely from
        // being physically close while the user is actually on the far/exit
        // side (already past it, or looping back on the return leg), which
        // reads as wrong to a driver even though distance+heading alone
        // look fine.
        if (zone.entryLine?.length === 2 && zone.exitLine?.length === 2) {
          const entryMid = this.lineMidpoint(zone.entryLine);
          const exitMid = this.lineMidpoint(zone.exitLine);
          const distToEntry = distance(userPt, entryMid, { units: 'miles' });
          const distToExit = distance(userPt, exitMid, { units: 'miles' });
          if (distToEntry >= distToExit) continue;
        }

        if (!best || distanceMi < best.distanceMi) {
          best = { zone, distanceMi };
        }
      } catch {
        // Skip malformed geometry
      }
    }

    return best?.zone ?? null;
  }

  // entryLine/exitLine coordinates are ambiguously-ordered (see toLatLng) —
  // normalizeToLngLat resolves that the same way the rest of the codebase
  // does before handing coordinates to turf, which requires [lng, lat].
  private static lineMidpoint(line: [number, number][]): ReturnType<typeof point> {
    const [aLng, aLat] = normalizeToLngLat(line[0]);
    const [bLng, bLat] = normalizeToLngLat(line[1]);
    return point([(aLng + bLng) / 2, (aLat + bLat) / 2]);
  }

  static isPointInZone(userPosition: [number, number], zone: SpatZone): boolean {
    return this.isPointInPolygon(userPosition, zone.polygon);
  }

  /**
   * Check if line segment (p1 -> p2) intersects with a line (lineStart -> lineEnd)
   * Returns true if segments intersect
   */
  static doSegmentsIntersect(
    p1: [number, number],
    p2: [number, number],
    lineStart: [number, number],
    lineEnd: [number, number]
  ): boolean {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = lineStart;
    const [x4, y4] = lineEnd;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denom) < 1e-10) return false; // Parallel lines

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  /**
   * Check if segment crosses the entry line (entering zone)
   */
  static crossesEntryLine(
    prevPos: [number, number],
    currPos: [number, number],
    zone: SpatZone
  ): boolean {
    if (!zone.entryLine || zone.entryLine.length !== 2) return false;
    return this.doSegmentsIntersect(prevPos, currPos, zone.entryLine[0], zone.entryLine[1]);
  }

  /**
   * Check if segment crosses the exit line (exiting zone)
   */
  static crossesExitLine(
    prevPos: [number, number],
    currPos: [number, number],
    zone: SpatZone
  ): boolean {
    if (!zone.exitLine || zone.exitLine.length !== 2) return false;
    return this.doSegmentsIntersect(prevPos, currPos, zone.exitLine[0], zone.exitLine[1]);
  }

  private static isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [lat, lng] = point;
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return false;
    }

    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [lngI, latI] = polygon[i];
      const [lngJ, latJ] = polygon[j];

      if (((latI > lat) !== (latJ > lat)) &&
          (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI)) {
        inside = !inside;
      }
    }

    return inside;
  }
}

export default SpatZoneService;