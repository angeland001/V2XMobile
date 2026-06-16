export type LngLat = [number, number];

export interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

export const isValidLngLat = (coordinate: LngLat | undefined | null): coordinate is LngLat => {
  if (!coordinate || coordinate.length !== 2) return false;
  const [longitude, latitude] = coordinate;
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
};

export const toGoogleLatLng = (coordinate: LngLat): GoogleLatLng => ({
  latitude: coordinate[1],
  longitude: coordinate[0],
});

export const toGooglePath = (coordinates: LngLat[] = []): GoogleLatLng[] =>
  coordinates.filter(isValidLngLat).map(toGoogleLatLng);

export const latLngTupleToGoogleLatLng = ([latitude, longitude]: [number, number]): GoogleLatLng => ({
  latitude,
  longitude,
});

const DEFAULT_MAP_CENTER: GoogleLatLng = {
  latitude: 35.0454,
  longitude: -85.3075,
};

const distanceFromDefaultCenter = ({ latitude, longitude }: GoogleLatLng): number =>
  Math.abs(latitude - DEFAULT_MAP_CENTER.latitude) +
  Math.abs(longitude - DEFAULT_MAP_CENTER.longitude);

export const normalizeToLngLat = (coordinate: [number, number]): LngLat => {
  const [first, second] = coordinate;
  const asLngLat = { latitude: second, longitude: first };
  const asLatLng = { latitude: first, longitude: second };

  return distanceFromDefaultCenter(asLatLng) < distanceFromDefaultCenter(asLngLat)
    ? [second, first]
    : [first, second];
};

export const toGoogleLatLngFlexible = (coordinate: [number, number]): GoogleLatLng =>
  toGoogleLatLng(normalizeToLngLat(coordinate));

export const toGooglePathFlexible = (coordinates: [number, number][] = []): GoogleLatLng[] =>
  coordinates.map(toGoogleLatLngFlexible);
