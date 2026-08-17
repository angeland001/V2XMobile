import { API_CONFIG } from '../../../core/api/config';
import type {
  PreemptionZoneConfig,
  PreemptionZoneConfigApiResponse,
} from '../models/PreemptionModels';

export class PreemptionConfigService {
  static async fetchAllConfigs(intersectionId: number): Promise<PreemptionZoneConfig[] | null> {
    const endpoint = `${API_CONFIG.DASHBOARD_API_URL}/api/preemption-zone-configs?intersection_id=${intersectionId}`;
    try {
      const response = await fetch(endpoint, { method: 'GET' });
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data)) return null;
      return data
        .filter((d: PreemptionZoneConfigApiResponse) => d?.spat_zone_id != null && d?.intersection_id != null)
        .map((d: PreemptionZoneConfigApiResponse) => ({
          id: Number(d.id),
          intersectionId: Number(d.intersection_id),
          spatZoneId: String(d.spat_zone_id),
          name: d.name,
          controllerIp: d.controller_ip,
          laneIds: Array.isArray(d.lane_ids) ? d.lane_ids : [],
          signalGroup: typeof d.signal_group === 'number' ? d.signal_group : null,
          preemptChannel: typeof d.preempt_channel === 'number' ? d.preempt_channel : null,
          status: d.status,
        }));
    } catch {
      return null;
    }
  }

  static async fetchConfigBySpatZoneId(
    spatZoneId: string,
  ): Promise<PreemptionZoneConfig | null> {
    const endpoint =
      `${API_CONFIG.DASHBOARD_API_URL}/api/preemption-zone-configs?spat_zone_id=${spatZoneId}`;

    console.log('[PreemptionConfigService] Fetching config for spat_zone_id:', spatZoneId);

    try {
      const response = await fetch(endpoint, { method: 'GET' });
      console.log('[PreemptionConfigService] Response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[PreemptionConfigService] No config found for zone:', spatZoneId);
          return null;
        }
        throw new Error(`Failed to load preemption config (${response.status})`);
      }

      const data = (await response.json()) as PreemptionZoneConfigApiResponse | null;
      console.log('[PreemptionConfigService] Response data:', data);

      if (!data || data.spat_zone_id == null || data.intersection_id == null) {
        console.log('[PreemptionConfigService] Data invalid or missing required fields');
        return null;
      }

      return {
        id: Number(data.id),
        intersectionId: Number(data.intersection_id),
        spatZoneId: String(data.spat_zone_id),
        name: data.name,
        controllerIp: data.controller_ip,
        laneIds: Array.isArray(data.lane_ids) ? data.lane_ids : [],
        signalGroup:
          typeof data.signal_group === 'number' ? data.signal_group : null,
        preemptChannel:
          typeof data.preempt_channel === 'number' ? data.preempt_channel : null,
        status: data.status,
      };
    } catch (error) {
      console.log('[PreemptionConfigService] Error:', error);
      return null;
    }
  }
}

export default PreemptionConfigService;
