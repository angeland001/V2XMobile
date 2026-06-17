// app/src/features/Map/models/Location.ts
export interface Coordinate {
  longitude: number;
  latitude: number;
  heading?: number; // Add optional heading property
}

export const toGeoJSONCoordinate = (coord: Coordinate): [number, number] => {
  return [coord.longitude, coord.latitude];
};

export default {};