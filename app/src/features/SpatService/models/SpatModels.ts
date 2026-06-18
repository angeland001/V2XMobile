// app/src/features/SpatService/models/SpatModels.ts

export interface SpatData {
  // Phase status groups (main signal states)
  phaseStatusGroupGreens: number[];
  phaseStatusGroupReds: number[];
  phaseStatusGroupYellows: number[];
  
  // Pedestrian signal states
  phaseStatusGroupDontWalks: number[];
  phaseStatusGroupPedClears: number[];
  phaseStatusGroupWalks: number[];
  
  // Overlap signal states
  overlapStatusGroupReds: number[];
  overlapStatusGroupYellows: number[];
  overlapStatusGroupGreens: number[];
  
  // System status
  spatIntersectionStatus: number;
  phaseBlockCount: number;
  flashingOutputPhaseStatus: number;
  flashingOutputOverlapStatus: number;
  timebaseAscActionStatus: number;
  spatDiscontinuousChangeFlag: number;
  spatMessageSeqCounter: number;
  
  // Pedestrian calls/detection
  spatPedestrianCall: number;
  spatPedestrianDetect: number;
  
  // Timing data for all 16 phases
  spatVehMinTimeToChange1: number;
  spatVehMaxTimeToChange1: number;
  spatPedMinTimeToChange1: number;
  spatPedMaxTimeToChange1: number;
  spatOvlpMinTimeToChange1: number;
  spatOvlpMaxTimeToChange1: number;
  
  spatVehMinTimeToChange2: number;
  spatVehMaxTimeToChange2: number;
  spatPedMinTimeToChange2: number;
  spatPedMaxTimeToChange2: number;
  spatOvlpMinTimeToChange2: number;
  spatOvlpMaxTimeToChange2: number;
  
  spatVehMinTimeToChange3: number;
  spatVehMaxTimeToChange3: number;
  spatPedMinTimeToChange3: number;
  spatPedMaxTimeToChange3: number;
  spatOvlpMinTimeToChange3: number;
  spatOvlpMaxTimeToChange3: number;
  
  spatVehMinTimeToChange4: number;
  spatVehMaxTimeToChange4: number;
  spatPedMinTimeToChange4: number;
  spatPedMaxTimeToChange4: number;
  spatOvlpMinTimeToChange4: number;
  spatOvlpMaxTimeToChange4: number;
  
  spatVehMinTimeToChange5: number;
  spatVehMaxTimeToChange5: number;
  spatPedMinTimeToChange5: number;
  spatPedMaxTimeToChange5: number;
  spatOvlpMinTimeToChange5: number;
  spatOvlpMaxTimeToChange5: number;
  
  spatVehMinTimeToChange6: number;
  spatVehMaxTimeToChange6: number;
  spatPedMinTimeToChange6: number;
  spatPedMaxTimeToChange6: number;
  spatOvlpMinTimeToChange6: number;
  spatOvlpMaxTimeToChange6: number;
  
  spatVehMinTimeToChange7: number;
  spatVehMaxTimeToChange7: number;
  spatPedMinTimeToChange7: number;
  spatPedMaxTimeToChange7: number;
  spatOvlpMinTimeToChange7: number;
  spatOvlpMaxTimeToChange7: number;
  
  spatVehMinTimeToChange8: number;
  spatVehMaxTimeToChange8: number;
  spatPedMinTimeToChange8: number;
  spatPedMaxTimeToChange8: number;
  spatOvlpMinTimeToChange8: number;
  spatOvlpMaxTimeToChange8: number;
  
  spatVehMinTimeToChange9: number;
  spatVehMaxTimeToChange9: number;
  spatPedMinTimeToChange9: number;
  spatPedMaxTimeToChange9: number;
  spatOvlpMinTimeToChange9: number;
  spatOvlpMaxTimeToChange9: number;
  
  spatVehMinTimeToChange10: number;
  spatVehMaxTimeToChange10: number;
  spatPedMinTimeToChange10: number;
  spatPedMaxTimeToChange10: number;
  spatOvlpMinTimeToChange10: number;
  spatOvlpMaxTimeToChange10: number;
  
  spatVehMinTimeToChange11: number;
  spatVehMaxTimeToChange11: number;
  spatPedMinTimeToChange11: number;
  spatPedMaxTimeToChange11: number;
  spatOvlpMinTimeToChange11: number;
  spatOvlpMaxTimeToChange11: number;
  
  spatVehMinTimeToChange12: number;
  spatVehMaxTimeToChange12: number;
  spatPedMinTimeToChange12: number;
  spatPedMaxTimeToChange12: number;
  spatOvlpMinTimeToChange12: number;
  spatOvlpMaxTimeToChange12: number;
  
  spatVehMinTimeToChange13: number;
  spatVehMaxTimeToChange13: number;
  spatPedMinTimeToChange13: number;
  spatPedMaxTimeToChange13: number;
  spatOvlpMinTimeToChange13: number;
  spatOvlpMaxTimeToChange13: number;
  
  spatVehMinTimeToChange14: number;
  spatVehMaxTimeToChange14: number;
  spatPedMinTimeToChange14: number;
  spatPedMaxTimeToChange14: number;
  spatOvlpMinTimeToChange14: number;
  spatOvlpMaxTimeToChange14: number;
  
  spatVehMinTimeToChange15: number;
  spatVehMaxTimeToChange15: number;
  spatPedMinTimeToChange15: number;
  spatPedMaxTimeToChange15: number;
  spatOvlpMinTimeToChange15: number;
  spatOvlpMaxTimeToChange15: number;
  
  spatVehMinTimeToChange16: number;
  spatVehMaxTimeToChange16: number;
  spatPedMinTimeToChange16: number;
  spatPedMaxTimeToChange16: number;
  spatOvlpMinTimeToChange16: number;
  spatOvlpMaxTimeToChange16: number;
  
  // Basic info
  timestamp: number;
  intersection: string;
}

export enum SignalState {
  GREEN = 'GREEN',
  YELLOW = 'YELLOW', 
  RED = 'RED',
  UNKNOWN = 'UNKNOWN'
}

export interface PhaseTimingInfo {
  phaseId: number;
  vehMinTimeToChange: number;
  vehMaxTimeToChange: number;
  pedMinTimeToChange: number;
  pedMaxTimeToChange: number;
  ovlpMinTimeToChange: number;
  ovlpMaxTimeToChange: number;
}

export interface LaneSignalStatus {
  laneId: number;
  signalGroups: number[];
  signalState: SignalState;
  timingInfo?: PhaseTimingInfo[];
}

export interface ApproachSignalStatus {
  approachId: string;
  approachName: string;
  laneIds: number[];
  overallSignalState: SignalState;
  laneSignalStatuses: LaneSignalStatus[];
  timestamp: number;
  estimatedTimeToChange?: number;
}

export default {};