// app/src/features/PedestrianDetector/models/PedestrianDetection.ts

export interface PedestrianAlert {
    timestamp: string;
    pedestrianCount: number;
    isVehicleApproaching: boolean;
  }

export default {};