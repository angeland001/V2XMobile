import { API_CONFIG } from '../../../core/api/config';
import type { Nv2xSrmIngestPayload, SrmPayload } from '../models/PreemptionModels';

export class PreemptionApiService {
  static buildRequestEndpoint(): string {
    return `${API_CONFIG.DASHBOARD_API_URL}/api/preemption`;
  }

  static buildSrmPayload(
    intersectionId: number,
    signalGroup: number,
    laneId: number,
  ): SrmPayload {
    return {
      value: [
        'SignalRequestMessage',
        {
          requestor: {
            id: ['stationID', intersectionId],
          },
          requests: [
            {
              request: {
                inBoundLane: ['lane', laneId],
                signalGroup,
              },
            },
          ],
        },
      ],
    };
  }

  // nv2xSlug excludes the "nv2x_" prefix (as stored in the dashboard's
  // intersections.nv2x_slug column) — this adds it back for the wire format.
  static buildNv2xIngestPayload(
    nv2xSlug: string,
    lat: number,
    lon: number,
    srm: SrmPayload,
  ): Nv2xSrmIngestPayload {
    return {
      intersection: `nv2x_${nv2xSlug}`,
      vehicle_type: API_CONFIG.NV2X_VEHICLE_TYPE,
      lat,
      lon,
      request_type: 'preemptionRequest',
      srm,
    };
  }
}

export default PreemptionApiService;
