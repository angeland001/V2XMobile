// app/src/features/SDSM/interfaces/IVehicleDisplay.ts
/**
 * Interface for vehicle display view models in SDSM feature
 */
export interface IVehicleDisplay {
  // Core properties
  vehicles: Array<{
    id: number;
    coordinates: [number, number]; // [lat, lng]
    timestamp: string;
    heading?: number;
    speed?: number;
    size?: {
      width: number | null;
      length: number | null;
    };
  }>;

  isActive: boolean;
  vehicleCount: number;

  // Methods
  getMapCoordinates(vehicle: any): [number, number];
  cleanup(): void;
}

export default {};
