export interface TimMessage {
  id: number;
  tim_type: string;
  category: 'safety' | 'regulatory' | 'informational';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  severity: number;
  description: string | null;
  itis_codes: number[];
  intersection_id: number | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}
