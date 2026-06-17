// Core data types - no logic, just types
export interface VehicleData {
  id: number;
  coordinates: [number, number]; // [lat, lng]
  heading?: number;
  speed?: number;
  size?: { width: number | null; length: number | null };
}

export interface VRUData {
  id: number;
  coordinates: [number, number]; // [lat, lng]
  heading?: number;
  speed?: number;
  size?: { width: number | null; length: number | null };
}

export interface SDSMResponse {
  intersectionID: string;
  intersection: string;
  timestamp: string;
  objects: SDSMObject[];
}

export interface SDSMObject {
  objectID: number;
  type: 'vehicle' | 'vru';
  timestamp: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
  heading?: number;
  speed?: number;
  size?: { width: number | null; length: number | null };
}

export default {};