import { SDSMResponse, VehicleData, VRUData } from "../models/SDSMTypes";

// Pure functions for data transformation - no state
export class SDSMDataService {
  private static normalizeCoordinates(coords: [number, number]): [number, number] {
    const [first, second] = coords;
    
    // Validate coordinates are in valid ranges
    const isLatLngFormat = Math.abs(first) <= 90 && Math.abs(second) <= 180;
    
    if (!isLatLngFormat) {
      return [0, 0];
    }
    
    // API returns [lat, lng], store as [lat, lng]
    return [first, second];
  }

  static extractVehicles(response: SDSMResponse): VehicleData[] {
    if (!response?.objects) return [];

    return response.objects
      .filter(obj => obj.type === 'vehicle')
      .map(obj => {
        const coords = this.normalizeCoordinates(obj.location.coordinates);
        return {
          id: obj.objectID,
          coordinates: coords,
          heading: obj.heading,
          speed: obj.speed,
          size: obj.size
        };
      })
      .filter(v => v.coordinates[0] !== 0 && v.coordinates[1] !== 0);
  }

  static extractVRUs(response: SDSMResponse): VRUData[] {
    if (!response?.objects) return [];

    return response.objects
      .filter(obj => obj.type === 'vru')
      .map(obj => {
        const coords = this.normalizeCoordinates(obj.location.coordinates);
        return {
          id: obj.objectID,
          coordinates: coords,
          heading: obj.heading,
          speed: obj.speed,
          size: obj.size
        };
      })
      .filter(v => v.coordinates[0] !== 0 && v.coordinates[1] !== 0);
  }

  static toMapCoordinates(data: VehicleData | VRUData): [number, number] {
    const [lat, lng] = data.coordinates;
    
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return [0, 0];
    }
    
    // Convert [lat, lng] to [lng, lat] for map rendering.
    return [lng, lat];
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
