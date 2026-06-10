// app/src/features/SpatService/services/SpatZoneService.ts

import { API_CONFIG } from '../../../core/api/config';

export interface SpatZone {
  id: string;
  name: string;
  polygon: [number, number][];
  laneIds: number[];
  signalGroup: number;
  intersection: 'georgia' | 'houston';
  entryLine?: [number, number][]; // Line user crosses to enter zone
  exitLine?: [number, number][]; // Line user crosses to exit zone
}


interface DashboardSpatZoneApiResponse {
  id: number;
  name: string;
  lane_ids: number[];
  signal_group: number;
  polygon: { type: 'Polygon'; coordinates: [number, number][][] };
  entry_line: { type: 'LineString'; coordinates: [number, number][] };
  exit_line: { type: 'LineString'; coordinates: [number, number][] };
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
    intersection: 'georgia',
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
    intersection: 'georgia',
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
    intersection: 'georgia',
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
    intersection: 'georgia',
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

export class SpatZoneService {
  private static zoneCache: Map<string, boolean> = new Map();
  private static dashboardZones: SpatZone[] = [];

  private static toLatLng(coord: [number, number]): [number, number] {
    // Dashboard/GeoJSON is [lng, lat], app movement tracking uses [lat, lng].
    return [coord[1], coord[0]];
  }

  private static inferIntersection(name: string): 'georgia' | 'houston' {
    return name.toLowerCase().includes('houston') ? 'houston' : 'georgia';
  }

  static async loadZonesFromDashboard(): Promise<void> {
    try {
      const endpoint = `${API_CONFIG.DASHBOARD_API_URL}/api/spat-zones`;
      const response = await fetch(endpoint, { method: 'GET' });
      if (!response.ok) {
        console.log(`[SPAT] Dashboard zone fetch failed: ${response.status}`);
        return;
      }

      const data: DashboardSpatZoneApiResponse[] = await response.json();
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
          intersection: this.inferIntersection(z.name),
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


  static findZoneForPosition(userPosition: [number, number]): SpatZone | null {
    if (!userPosition || userPosition[0] === 0 || userPosition[1] === 0) {
      return null;
    }

    for (const zone of this.getActiveZones()) {
      if (this.isPointInZone(userPosition, zone)) {
        return zone;
      }
    }

    return null;
  }

  static findZoneById(zoneId: string): SpatZone | null {
    return this.getActiveZones().find(zone => zone.id === zoneId) || null;
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