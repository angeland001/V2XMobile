export interface PreemptionZoneConfigApiResponse {
  id: number;
  intersection_id: number;
  name: string;
  spat_zone_id: number;
  controller_ip: string | null;
  lane_ids: number[];
  signal_group: number;
  status: string;
}

export interface PreemptionZoneConfig {
  id: number;
  intersectionId: number;
  spatZoneId: string;
  name: string;
  controllerIp: string | null;
  laneIds: number[];
  signalGroup: number | null;
  status: string;
}

export interface SrmPayload {
  value: [
    'SignalRequestMessage',
    {
      requestor: {
        id: [string, number];
      };
      requests: Array<{
        request: {
          inBoundLane: [string, number];
          signalGroup: number;
        };
      }>;
    }
  ];
}
