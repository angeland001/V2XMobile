// app/src/features/SpatService/services/SpatWebSocketService.ts
//
// Client for spat_bridge.py's local relay of CUIP's `spat-events` stream, which is
// multiplexed across all CUIP-instrumented corridor intersections (not just
// Georgia/Houston). Each message is expected to carry an intersection-identifying
// field, mirroring the sdsm-events convention (`intersectionID`/`intersection`,
// see VehicleDisplayViewModel.ts) — this is unverified against a live spat-events
// payload, so the first message received is logged in full to confirm/correct it.
//
// Connection is fully demand-driven: SpatViewModel only ever needs live data for
// the one intersection whose zone the user is currently standing in, so the
// socket connects on zone entry (via connectFor) and closes on zone exit (via
// disconnect) instead of staying open for the whole app session. On connect, the
// client tells the bridge which intersection it wants (see the `subscribe`
// message below); the bridge filters server-side so this client only ever
// receives that one intersection's messages, not all ~13 on the corridor.

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
  private static isConnecting = false;
  private static reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private static latestByIntersection: Map<string, CacheEntry> = new Map();
  private static loggedFirstMessage = false;
  // TEMP diagnostic, logs every frame's status-group arrays (not the full
  // ~100-field payload) so they can be read directly off the console during
  // a test run. Was used to investigate the SPaT-driven preemption traffic
  // light, since retired (see PreemptionStatusBanner) in favor of a
  // protocol-only status display that doesn't depend on this feed at all —
  // flip back on only if some other SPaT-feed investigation needs it.
  private static readonly LOG_EVERY_FRAME = false;
  // The intersection the current zone wants live data for. null means nothing
  // needs a connection right now — drives both whether to (re)connect and
  // whether onclose should schedule a reconnect at all.
  private static desiredIntersection: string | null = null;

  /**
   * Connects (if not already) and (re)subscribes the bridge to `intersectionName`.
   * Call on every zone entry / zone-to-zone transition whose new zone has CUIP
   * coverage — safe to call repeatedly with the same value.
   */
  static connectFor(intersectionName: string): void {
    if (!API_CONFIG.SPAT_WS_ENABLED) return;
    SpatWebSocketService.desiredIntersection = intersectionName;

    if (SpatWebSocketService.socket?.readyState === WebSocket.OPEN) {
      SpatWebSocketService.sendSubscribe(intersectionName);
      return;
    }

    if (SpatWebSocketService.isConnecting) return; // onopen will subscribe once ready
    SpatWebSocketService.connect();
  }

  /** Closes the connection — call on zone exit. Nothing needs live data once
   *  the user has left every CUIP-covered zone, so there's no reason to keep a
   *  socket (and the resulting parse traffic) alive. */
  static disconnect(): void {
    SpatWebSocketService.desiredIntersection = null;

    if (SpatWebSocketService.reconnectTimeoutId) {
      clearTimeout(SpatWebSocketService.reconnectTimeoutId);
      SpatWebSocketService.reconnectTimeoutId = null;
    }
    SpatWebSocketService.isConnecting = false;

    if (SpatWebSocketService.socket) {
      const socket = SpatWebSocketService.socket;
      SpatWebSocketService.socket = null;
      socket.close();
    }
  }

  private static sendSubscribe(intersectionName: string): void {
    if (SpatWebSocketService.socket?.readyState !== WebSocket.OPEN) return;
    SpatWebSocketService.socket.send(JSON.stringify({ subscribe: intersectionName }));
  }

  private static connect(): void {
    SpatWebSocketService.isConnecting = true;
    try {
      const ws = new WebSocket(API_CONFIG.SPAT_WS_URL);
      SpatWebSocketService.socket = ws;

      ws.onopen = () => {
        console.log('[SpatWS] Connected:', API_CONFIG.SPAT_WS_URL);
        SpatWebSocketService.isConnecting = false;
        if (SpatWebSocketService.desiredIntersection) {
          SpatWebSocketService.sendSubscribe(SpatWebSocketService.desiredIntersection);
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

          if (!SpatWebSocketService.loggedFirstMessage) {
            SpatWebSocketService.loggedFirstMessage = true;
            console.log('[SpatWS] First spat-events message keys:', Object.keys(data));
            console.log('[SpatWS] First spat-events message raw:', JSON.stringify(data));
          }

          if (SpatWebSocketService.LOG_EVERY_FRAME) {
            console.log(
              `[SpatWS] frame intersection=${data.intersectionID ?? data.intersection ?? data.intersection_name ?? '?'}`,
              `seq=${data.spatMessageSeqCounter ?? '?'}`,
              `ts=${data.timestamp ?? '?'}`,
              `phaseG=${JSON.stringify(data.phaseStatusGroupGreens ?? [])}`,
              `phaseY=${JSON.stringify(data.phaseStatusGroupYellows ?? [])}`,
              `phaseR=${JSON.stringify(data.phaseStatusGroupReds ?? [])}`,
              `overlapG=${JSON.stringify(data.overlapStatusGroupGreens ?? [])}`,
              `overlapY=${JSON.stringify(data.overlapStatusGroupYellows ?? [])}`,
              `overlapR=${JSON.stringify(data.overlapStatusGroupReds ?? [])}`,
              `intStatus=${data.spatIntersectionStatus ?? '?'}`,
              `discFlag=${data.spatDiscontinuousChangeFlag ?? '?'}`,
            );
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
        SpatWebSocketService.isConnecting = false;
        // Only reconnect if something still wants live data — otherwise this
        // would spin forever after the user has left every zone.
        if (SpatWebSocketService.desiredIntersection) {
          SpatWebSocketService.scheduleReconnect();
        }
      };
    } catch {
      SpatWebSocketService.scheduleReconnect();
    }
  }

  private static scheduleReconnect(): void {
    if (!API_CONFIG.SPAT_WS_ENABLED) return;
    if (!SpatWebSocketService.desiredIntersection) return;
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
