export type TimCategory = 'safety' | 'regulatory' | 'informational';

export interface TimMessage {
  id: number;
  tim_type: string;
  category: TimCategory;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  severity: number;
  description: string | null;
  itis_codes: number[];
  intersection_id: number | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

const TIM_TYPE_CATEGORY: Record<string, TimCategory> = {
  // Safety
  'work-zone-warning':          'safety',
  'incident-emergency-alert':   'safety',
  'pedestrian-vru-warning':     'safety',
  'distress-notification':      'safety',
  'rail-crossing-warning':      'safety',

  // Regulatory
  'reduced-speed-zone-warning': 'regulatory',
  'road-closure':               'regulatory',
  'hov-lane-advisory':          'regulatory',
  'bridge-clearance-warning':   'regulatory',

  // Informational
  'spot-weather-warning':       'informational',
  'congestion-advisory':        'informational',
  'detour-route-guidance':      'informational',
  'parking-notification':       'informational',
  'generic-road-sign':          'informational',
};

export function timCategoryFromType(tim_type: string): TimCategory {
  const category = TIM_TYPE_CATEGORY[tim_type];
  return category ?? 'informational';
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

export default timCategoryFromType;
