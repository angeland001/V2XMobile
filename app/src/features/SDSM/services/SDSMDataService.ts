import { SDSMResponse, VehicleData, VRUData } from "../models/SDSMTypes";

// Pure functions for data transformation - no state
export class SDSMDataService {
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
