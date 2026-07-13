// app/src/features/SpatService/services/SpatWebSocketService.ts
//
// Client for spat_bridge.py's local relay of CUIP's `spat-events` stream, which is
// multiplexed across all CUIP-instrumented corridor intersections (not just
// Georgia/Houston). Each message is expected to carry an intersection-identifying
// field, mirroring the sdsm-events convention (`intersectionID`/`intersection`,
// see VehicleDisplayViewModel.ts) — this is unverified against a live spat-events
// payload, so the first message received is logged in full to confirm/correct it.

import { API_CONFIG } from '../../../core/api/config';

export interface SpatWsPayload {
  [key: string]: any;
}

interface CacheEntry {
  raw: SpatWsPayload;
  intersectionKey: string;
  receivedAt: number;
}

const RECONNECT_DELAY_MS = 2000;
// spat-events is documented as high-frequency with "no wait times" — data older
// than this is treated as "no live coverage" rather than a stale-but-valid read.
const STALE_MS = 5000;

// Word-token overlap, not whole-string containment: "Georgia Lanes 4 & 5" and
// "MLK_Georgia" share no substring relationship end-to-end, but do share the
// meaningful token "georgia". Short/noise tokens (street abbreviations, lane
// numbers) are dropped so they can't produce a false match.
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

function tokensOverlap(a: string[], b: string[]): boolean {
  return a.some((t) => b.includes(t));
}

export class SpatWebSocketService {
  private static socket: WebSocket | null = null;
  private static isStarted = false;
  private static reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private static latestByIntersection: Map<string, CacheEntry> = new Map();
  private static loggedFirstMessage = false;

  /** Idempotent — safe to call from every SpatViewModel instance. */
  static ensureConnected(): void {
    if (!API_CONFIG.SPAT_WS_ENABLED) return;
    if (SpatWebSocketService.isStarted) return;
    SpatWebSocketService.isStarted = true;
    SpatWebSocketService.connect();
  }

  private static connect(): void {
    try {
      const ws = new WebSocket(API_CONFIG.SPAT_WS_URL);
      SpatWebSocketService.socket = ws;

      ws.onopen = () => {
        console.log('[SpatWS] Connected:', API_CONFIG.SPAT_WS_URL);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

          if (!SpatWebSocketService.loggedFirstMessage) {
            SpatWebSocketService.loggedFirstMessage = true;
            console.log('[SpatWS] First spat-events message keys:', Object.keys(data));
            console.log('[SpatWS] First spat-events message raw:', JSON.stringify(data));
          }

          const intersectionRaw =
            data.intersectionID ?? data.intersection ?? data.intersection_name ?? null;
          if (!intersectionRaw || typeof intersectionRaw !== 'string') return;

          SpatWebSocketService.latestByIntersection.set(intersectionRaw, {
            raw: data,
            intersectionKey: intersectionRaw,
            receivedAt: Date.now(),
          });
        } catch {
          // Skip malformed messages
        }
      };

      ws.onerror = () => {
        console.log('[SpatWS] Connection error');
      };

      ws.onclose = () => {
        SpatWebSocketService.socket = null;
        if (SpatWebSocketService.isStarted) {
          SpatWebSocketService.scheduleReconnect();
        }
      };
    } catch {
      SpatWebSocketService.scheduleReconnect();
    }
  }

  private static scheduleReconnect(): void {
    if (!API_CONFIG.SPAT_WS_ENABLED) return;
    if (SpatWebSocketService.reconnectTimeoutId) return;
    SpatWebSocketService.reconnectTimeoutId = setTimeout(() => {
      SpatWebSocketService.reconnectTimeoutId = null;
      SpatWebSocketService.connect();
    }, RECONNECT_DELAY_MS);
  }

  /**
   * Fuzzy-matches `intersectionName` (from dashboard zone/preemption config)
   * against intersection identifiers seen on the live stream so far, and
   * returns the freshest matching payload. Returns null when no live match
   * exists yet, or the freshest match is stale — both mean "no SPaT coverage
   * for this intersection" to the caller.
   */
  static getLatest(intersectionName: string | null): SpatWsPayload | null {
    if (!intersectionName) return null;
    const needleTokens = tokens(intersectionName);
    if (needleTokens.length === 0) return null;

    let best: CacheEntry | null = null;
    for (const entry of SpatWebSocketService.latestByIntersection.values()) {
      if (tokensOverlap(needleTokens, tokens(entry.intersectionKey))) {
        if (!best || entry.receivedAt > best.receivedAt) {
          best = entry;
        }
      }
    }

    if (!best) return null;
    if (Date.now() - best.receivedAt > STALE_MS) return null;
    return best.raw;
  }
}

export default SpatWebSocketService;
