// app/src/features/SpatService/services/SpatApiService.ts
//
// Pure parsing utilities over a raw SPaT payload (regardless of transport —
// currently sourced from SpatWebSocketService's cache of the spat-events
// stream). No network calls live here; see spat_bridge.py + SpatWebSocketService
// for how live data actually reaches the app.

import { SignalState } from '../models/SpatModels';

export class SpatApiService {
  static getSignalStateForGroup(spatData: Record<string, any>, signalGroup: number): SignalState {
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

  // Unit assumption (seconds) is unverified against the live feed — if field-testing
  // shows values ~10x too large, the source data is likely deciseconds (SAE J2735
  // convention) and needs a /10 divisor here.
  static getPhaseTimingForGroup(
    spatData: Record<string, any>,
    signalGroup: number,
  ): { minS: number; maxS: number } | null {
    if (!spatData) return null;

    const minRaw = spatData[`spatVehMinTimeToChange${signalGroup}`];
    const maxRaw = spatData[`spatVehMaxTimeToChange${signalGroup}`];

    if (typeof minRaw !== 'number' || typeof maxRaw !== 'number') return null;
    if (maxRaw <= 0) return null;

    return { minS: minRaw, maxS: maxRaw };
  }

}

export default SpatApiService;
