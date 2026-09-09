export interface PreemptionZoneConfigApiResponse {
  id: number;
  intersection_id: number;
  name: string;
  // N-V2X mobile-app intersection key, minus the "nv2x_" prefix (e.g.
  // "mlk_georgia") — see V2X-Dashboard's 022_add_nv2x_slug_to_intersections.sql.
  // Null until the dashboard backfills it for a given intersection.
  nv2x_slug: string | null;
  spat_zone_id: number;
  controller_ip: string | null;
  lane_ids: number[];
  signal_group: number;
  preempt_channel: number;
  status: string;
}

export interface PreemptionZoneConfig {
  id: number;
  intersectionId: number;
  spatZoneId: string;
  name: string;
  nv2xSlug: string | null;
  controllerIp: string | null;
  laneIds: number[];
  signalGroup: number | null;
  // The controller's SNMP preempt channel — this is what actually gets
  // activated on grant. Non-null is what marks a session as active for
  // display purposes; see PreemptionViewModel.requestedPreemptChannel.
  preemptChannel: number | null;
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

export type SsmStatus = 'requesting' | 'granted' | 'cancelled' | null;

// Wire payload for POST /nv2x-srm/api/v1/srm (roadaware Kafka ingest,
// confirmed with the dashboard team — see PreemptionApiService.ts).
export interface Nv2xSrmIngestPayload {
  intersection: string; // "nv2x_<slug>"
  vehicle_type: string;
  lat: number;
  lon: number;
  request_type: string;
  srm: SrmPayload;
}

export default {};
