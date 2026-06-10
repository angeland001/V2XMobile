import { API_CONFIG } from '../../../core/api/config';
import type { SrmPayload } from '../models/PreemptionModels';

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
}
