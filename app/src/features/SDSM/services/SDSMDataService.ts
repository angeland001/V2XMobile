import { SDSMResponse, VehicleData, VRUData } from "../models/SDSMTypes";

const EARTH_RADIUS_M = 6371000;

// Pure functions for data transformation - no state
export class SDSMDataService {
  /**
   * Haversine distance in meters between two [lat, lng] points.
   */
  static distanceMeters(a: [number, number], b: [number, number]): number {
    const [lat1, lng1] = a;
    const [lat2, lng2] = b;

    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const sinΔφ = Math.sin(Δφ / 2);
    const sinΔλ = Math.sin(Δλ / 2);
    const h = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;

    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  /**
   * Drop objects farther than radiusMeters from userLocation ([lat, lng]).
   */
  static filterByRadius<T extends { coordinates: [number, number] }>(
    objects: T[],
    userLocation: [number, number],
    radiusMeters: number
  ): T[] {
    return objects.filter(obj => this.distanceMeters(obj.coordinates, userLocation) <= radiusMeters);
  }

  static extractVehicles(response: SDSMResponse): VehicleData[] {
    if (!response?.objects) return [];

    return response.objects
      .filter(obj => obj.type === 'vehicle')
      .map(obj => ({
        id: obj.objectID,
        coordinates: obj.location.coordinates,
        heading: obj.heading,
        speed: obj.speed,
        size: obj.size
      }))
      .filter(v => v.coordinates[0] !== 0 && v.coordinates[1] !== 0);
  }

  static extractVRUs(response: SDSMResponse): VRUData[] {
    if (!response?.objects) return [];

    return response.objects
      .filter(obj => obj.type === 'vru')
      .map(obj => ({
        id: obj.objectID,
        coordinates: obj.location.coordinates,
        heading: obj.heading,
        speed: obj.speed,
        size: obj.size
      }))
      .filter(v => v.coordinates[0] !== 0 && v.coordinates[1] !== 0);
  }

  static toMapCoordinates(data: VehicleData | VRUData): [number, number] {
    const [lat, lng] = data.coordinates;
    return [lng, lat]; // Map rendering uses [lng, lat] internally.
  }

  static hasVehicleChanged(oldVehicle: VehicleData, newVehicle: VehicleData): boolean {
    return oldVehicle.coordinates[0] !== newVehicle.coordinates[0] ||
           oldVehicle.coordinates[1] !== newVehicle.coordinates[1] ||
           oldVehicle.heading !== newVehicle.heading;
  }

  static hasVRUChanged(oldVRU: VRUData, newVRU: VRUData): boolean {
    return oldVRU.coordinates[0] !== newVRU.coordinates[0] ||
           oldVRU.coordinates[1] !== newVRU.coordinates[1] ||
           oldVRU.heading !== newVRU.heading;
  }
}

export default SDSMDataService;
