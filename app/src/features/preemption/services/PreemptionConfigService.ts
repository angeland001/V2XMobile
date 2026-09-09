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
          nv2xSlug: d.nv2x_slug ?? null,
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
        nv2xSlug: data.nv2x_slug ?? null,
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

  // The dashboard's configured preempt-duration bounds (NTCIP minDuration_s/
  // maxOut_s) for a zone config — used by PreemptionCountdown to show a real
  // "time remaining" readout instead of an elapsed-only stopwatch. Backed by
  // a live SNMP read on the server (cached briefly there), so this can be
  // slower than the other reads on this service — call it once per grant,
  // not on a tight poll.
  static async fetchTimingBounds(
    zoneConfigId: number,
  ): Promise<{ minDurationS: number | null; maxOutS: number | null } | null> {
    const endpoint =
      `${API_CONFIG.DASHBOARD_API_URL}/api/preemption-zone-configs/${zoneConfigId}/timing-bounds`;

    console.log('[PreemptionConfigService] Fetching timing bounds for zone config id:', zoneConfigId);

    try {
      const response = await fetch(endpoint, { method: 'GET' });
      console.log('[PreemptionConfigService] Timing bounds response status:', response.status);

      if (!response.ok) {
        console.log('[PreemptionConfigService] No timing bounds available (non-OK response)');
        return null;
      }

      const data = await response.json();
      console.log('[PreemptionConfigService] Timing bounds data:', data);

      return {
        minDurationS: typeof data?.min_duration_s === 'number' ? data.min_duration_s : null,
        maxOutS: typeof data?.max_out_s === 'number' ? data.max_out_s : null,
      };
    } catch (error) {
      console.log('[PreemptionConfigService] Timing bounds fetch error:', error);
      return null;
    }
  }
}

export default PreemptionConfigService;
