// app/src/features/SpatService/services/SpatApiService.ts

import { SignalState } from '../models/SpatModels';

export interface SpatApiResponse {
  phaseStatusGroupReds: number[];
  phaseStatusGroupYellows: number[];
  phaseStatusGroupGreens: number[];
  timestamp: number;
  [key: string]: any;
}

export class SpatApiService {
  private static readonly ENDPOINTS = {
    georgia: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/mlk_spat_events/MLK_Georgia',
    houston: 'http://roadaware.cuip.research.utc.edu/cv2x/latest/mlk_spat_events/MLK_Houston',
  };

  private static readonly FAST_TIMEOUT = 1000;
  private static readonly CACHE_DURATION = 200;
  private static cache: Map<string, { data: SpatApiResponse; timestamp: number }> = new Map();

  static async fetchMlkGeorgiaSpatData(): Promise<SpatApiResponse | null> {
    return this.fetchSpatDataByUrl(this.ENDPOINTS.georgia, 'mlk_georgia');
  }

  static async fetchSpatData(intersection: 'georgia' | 'houston'): Promise<SpatApiResponse | null> {
    return this.fetchSpatDataByUrl(this.ENDPOINTS[intersection], intersection);
  }

  private static async fetchSpatDataByUrl(url: string, cacheKey: string): Promise<SpatApiResponse | null> {
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.FAST_TIMEOUT);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: now });

      return data;
    } catch (_error) {
      return null;
    }
  }

  static getSignalStateForGroup(spatData: SpatApiResponse, signalGroup: number): SignalState {
    if (!spatData) return SignalState.UNKNOWN;

    if (spatData.phaseStatusGroupGreens?.includes(signalGroup)) {
      return SignalState.GREEN;
    }

    if (spatData.phaseStatusGroupYellows?.includes(signalGroup)) {
      return SignalState.YELLOW;
    }

    if (spatData.phaseStatusGroupReds?.includes(signalGroup)) {
      return SignalState.RED;
    }

    return SignalState.UNKNOWN;
  }

  static clearCache(): void {
    this.cache.clear();
  }
}

export default SpatApiService;
