import { makeAutoObservable, runInAction } from 'mobx';
import { API_CONFIG } from '../../../core/api/config';
import type { SpatZone } from '../../SpatService/services/SpatZoneService';
import { SpatZoneService } from '../../SpatService/services/SpatZoneService';
import type { PreemptionZoneConfig, SrmPayload, SsmStatus } from '../models/PreemptionModels';
import { PreemptionApiService } from '../services/PreemptionApiService';
import { PreemptionConfigService } from '../services/PreemptionConfigService';
import { RetryService } from '../services/RetryService';

export class PreemptionViewModel {
  isEnabled = false;

  // Session state
  sessionId: string | null = null;
  insideZone = false;
  ssmStatus: SsmStatus = null;
  // Wall-clock ms timestamp of the rising edge into 'granted' — null whenever
  // ssmStatus isn't 'granted'. Purely for PreemptionStatusBanner's client-side
  // elapsed-timer display; never sent to the backend.
  grantedAt: number | null = null;
  // The dashboard's configured preempt-duration bounds (NTCIP minDuration_s/
  // maxOut_s) for the active session's zone, fetched once per grant via
  // PreemptionConfigService.fetchTimingBounds — see startPreemption. null
  // until that fetch resolves, or if the zone has no controller/timing data
  // configured. Drives PreemptionCountdown's "time remaining" readout;
  // reset in lockstep with grantedAt by setSsmStatus below.
  timingBounds: { minDurationS: number | null; maxOutS: number | null } | null = null;
  activeZoneName: string | null = null;
  // Timestamp of the current 1.5s heartbeat cycle's start. No longer read by
  // any UI (previously drove a progress-bar animation that's since been
  // removed) — left in place since it's part of the heartbeat timing logic
  // itself, not the display layer.
  heartbeatCycleStart: number | null = null;

  // requestedSignalGroup is sourced from the dashboard config; controllerSignalState
  // is current_state, which the preempt bridge reads live off the physical
  // controller — see MOBILE_INTEGRATION.md for what current_state reports.
  requestedSignalGroup: number | null = null;
  // The controller's SNMP preempt channel for the active session. Non-null
  // here is what PreemptionStatusBanner/MapView treat as "a session is
  // active" — see isPreempting in MapView.tsx.
  requestedPreemptChannel: number | null = null;
  controllerSignalState: number | null = null;

  // Whether the controller confirmed the most recent /preempt/clear call —
  // null until that response comes back. A live capture showed /preempt/clear
  // taking 4+ seconds to report back (the backend polls the controller up to
  // 10 times before giving up), so this runs on its own longer display
  // timeout (CLEAR_CONFIRM_DISPLAY_MS) rather than a short one that could
  // expire before the response even arrives. PreemptionStatusBanner surfaces
  // this so a clear that never confirmed doesn't just silently vanish as if
  // the session wrapped up cleanly.
  lastClearConfirmed: boolean | null = null;
  lastClearZoneName: string | null = null;
  private clearConfirmTimeout: NodeJS.Timeout | null = null;
  private static readonly CLEAR_CONFIRM_DISPLAY_MS = 10_000;

  // True in the window right after /preempt/start comes back empty/errored
  // (unreachable API, no session_id, retries exhausted) — previously this
  // was console-log only, so a driver had no way to know the request never
  // went through short of noticing "requested" never advanced to "granted".
  // Runs on its own display timeout the same way lastClearConfirmed does.
  lastStartFailed = false;
  lastStartFailedZoneName: string | null = null;
  private startFailedTimeout: NodeJS.Timeout | null = null;
  private static readonly START_FAILED_DISPLAY_MS = 10_000;

  // Tracks the most recent successful start/heartbeat response. Drives
  // feedStale below, which callers use to detect a preempt bridge that has
  // gone quiet instead of continuing to show a live-looking status.
  private lastHeartbeatSuccessAt: number | null = null;
  feedStale = false;
  // Mirrors SpatWebSocketService.STALE_MS so both feeds use the same
  // definition of "stale" across the app.
  private static readonly HEARTBEAT_STALE_MS = 5000;

  private previousPosition: [number, number] | null = null;
  private trackedZoneId: string | null = null;
  private isPendingStart = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private staleCheckInterval: NodeJS.Timeout | null = null;

  // Exit confirmation only: how many consecutive raw samples must disagree
  // with trackedZoneId before an exit is actually acted on — protects
  // against a single noisy "outside the polygon" GPS sample clearing a live
  // session. Entry is deliberately NOT gated this way (see syncPosition) —
  // it already requires an actual entry-line crossing, which is specific
  // enough on its own that waiting several more samples to confirm it just
  // adds latency between the real crossing and preemption firing.
  private readonly EXIT_CONFIRM_SAMPLES = 3;
  private exitCandidateStreak = 0;

  // Config Caching: cache preemption configs by spat_zone_id
  private configCache: Map<string, PreemptionZoneConfig> = new Map();

  private configSyncInterval: NodeJS.Timeout | null = null;
  private readonly CONFIG_SYNC_INTERVAL_MS = 30_000;

  constructor() {
    makeAutoObservable(this);
    this.configSyncInterval = setInterval(() => {
      this.syncConfigsWithDashboard();
    }, this.CONFIG_SYNC_INTERVAL_MS);
  }

  // Centralizes ssmStatus writes so grantedAt (rising edge into 'granted') and
  // its reset (any transition away from 'granted') can never drift out of
  // sync — the alternative is duplicating that edge comparison at every call
  // site below.
  private setSsmStatus(status: SsmStatus): void {
    if (status === 'granted' && this.ssmStatus !== 'granted') {
      this.grantedAt = Date.now();
    } else if (status !== 'granted') {
      this.grantedAt = null;
      this.timingBounds = null;
    }
    this.ssmStatus = status;
  }

  toggleEnabled(enabled: boolean): void {
    const wasEnabled = this.isEnabled;
    this.isEnabled = enabled;

    // Handle toggle OFF → clear session
    if (wasEnabled && !enabled && this.sessionId) {
      console.log('[Preemption] Toggle OFF: Clearing active session');
      this.clearSession();
    }
  }

  syncPosition(
    currentPosition: [number, number],
    allZones: SpatZone[],
  ): void {
    // Guard: invalid position or all zeros
    if (
      !Number.isFinite(currentPosition[0]) ||
      !Number.isFinite(currentPosition[1]) ||
      (currentPosition[0] === 0 && currentPosition[1] === 0)
    ) {
      this.previousPosition = currentPosition;
      return;
    }

    // Find which zone (if any) user is currently in, per this single raw sample
    const rawZone = allZones.find((zone) =>
      SpatZoneService.isPointInZone(currentPosition, zone)
    );
    const rawZoneId = rawZone?.id ?? 'none';
    const previousPosition = this.previousPosition;

    // Immediate, geometry-gated entry into a zone we're not already
    // tracking — a genuine crossing of that zone's own entry line (as
    // opposed to "polygon.contains() just flipped," which a single noisy
    // GPS sample can do near any boundary) is specific enough on its own
    // that it doesn't need multi-sample confirmation. Also covers a direct
    // zone-to-zone hop: the old zone's session is cleared right away, same
    // as before.
    if (rawZone && rawZone.id !== this.trackedZoneId && previousPosition && previousPosition[0] !== 0 && previousPosition[1] !== 0) {
      const hasEntryExitLines =
        Array.isArray(rawZone.entryLine) && rawZone.entryLine.length === 2 &&
        Array.isArray(rawZone.exitLine) && rawZone.exitLine.length === 2;

      const validEntry = hasEntryExitLines
        ? SpatZoneService.crossesEntryLine(previousPosition, currentPosition, rawZone) &&
          !SpatZoneService.crossesExitLine(previousPosition, currentPosition, rawZone)
        : true; // no lines configured — trust the raw reading rather than never firing

      if (validEntry) {
        console.log(`[Preemption] Zone entry confirmed: ${this.trackedZoneId} → ${rawZone.id}`);
        if (this.trackedZoneId !== null) {
          this.onZoneExit();
        }
        this.trackedZoneId = rawZone.id;
        this.exitCandidateStreak = 0;
        this.insideZone = true;

        if (this.isEnabled && !this.sessionId && !this.isPendingStart) {
          this.startPreemption(rawZone);
        }

        if (this.sessionId && !this.heartbeatInterval) {
          this.startHeartbeat();
        }
        this.previousPosition = currentPosition;
        return;
      }
    }

    // No fresh valid entry this sample — decide whether the currently
    // tracked zone should be confirmed exited. Debounced: a single stray
    // "not in my zone" reading must not itself clear a live session.
    if (this.trackedZoneId !== null) {
      if (rawZoneId === this.trackedZoneId) {
        this.exitCandidateStreak = 0;
      } else {
        this.exitCandidateStreak += 1;
        if (this.exitCandidateStreak >= this.EXIT_CONFIRM_SAMPLES) {
          console.log(`[Preemption] Zone exit confirmed (debounced): ${this.trackedZoneId} → ${rawZoneId}`);
          this.onZoneExit();
          this.trackedZoneId = null;
          this.insideZone = false;
          this.exitCandidateStreak = 0;
        }
      }
    }

    // Start heartbeat if confirmed inside a zone with an active session —
    // a level check each call, no debounced edge needed here.
    if (this.trackedZoneId !== null && this.sessionId && !this.heartbeatInterval) {
      this.startHeartbeat();
    }

    this.previousPosition = currentPosition;
  }

  // ============ Preemption Lifecycle ============

  private async startPreemption(zone: SpatZone): Promise<void> {
    if (this.sessionId || this.isPendingStart) return;
    this.isPendingStart = true;

    // Always fetch fresh to detect dashboard deletions
    console.log('[Preemption] Fetching config from backend for zone:', zone.name);
    const config = await PreemptionConfigService.fetchConfigBySpatZoneId(zone.id);

    if (config) {
      this.configCache.set(zone.id, config);
    } else {
      this.configCache.delete(zone.id);
      console.log('[Preemption] Zone has no preemption config (deleted or missing):', zone.name);
      this.isPendingStart = false;
      return;
    }

    if (config.signalGroup === null) {
      console.log('[Preemption] No signal group configured for zone:', zone.name);
      this.isPendingStart = false;
      return;
    }

    runInAction(() => {
      this.setSsmStatus('requesting');
      this.activeZoneName = zone.name;
      // A fresh attempt supersedes any leftover failure flag from a previous
      // one — don't let an old "request failed" linger through a new try.
      this.lastStartFailed = false;
      if (this.startFailedTimeout) {
        clearTimeout(this.startFailedTimeout);
        this.startFailedTimeout = null;
      }
    });

    console.log('[Preemption] START: Building SRM payload and calling /preempt/start');

    const laneId =
      Array.isArray(config.laneIds) && config.laneIds.length > 0
        ? config.laneIds[0]
        : 0;

    const srmPayload = PreemptionApiService.buildSrmPayload(
      config.intersectionId,
      config.signalGroup,
      laneId,
    );

    console.log('[Preemption] SRM Payload:', JSON.stringify(srmPayload, null, 2));
    console.log('[Preemption] Expected controller_ip:', config.controllerIp, '| signalGroup:', config.signalGroup);

    // Tag + forward this SRM to the N-V2X Kafka ingest so the dashboard's
    // Demo Day map/timeline can show it. Best-effort and non-blocking — the
    // actual controller preemption (below) must not wait on or fail because
    // of this side channel. this.previousPosition already reflects the
    // entry-triggering GPS fix: syncPosition sets it synchronously right
    // after calling startPreemption(), before this function's first await
    // (fetchConfigBySpatZoneId) resumes.
    this.postNv2xSrm(config, srmPayload);

    // Call START with SRM payload
    console.log('[Preemption] Calling /preempt/start for zone:', zone.name);
    const result = await this.callStart(srmPayload);
    runInAction(() => {
      this.isPendingStart = false;
      if (result) {
        this.sessionId = result.sessionId;
        this.setSsmStatus(result.ssmStatus);
        this.requestedSignalGroup = config.signalGroup;
        this.requestedPreemptChannel = config.preemptChannel;
        this.controllerSignalState = null;
        this.lastHeartbeatSuccessAt = Date.now();
        console.log(
          '[Preemption] START successful. Zone:',
          zone.name,
          'Session ID:',
          result.sessionId,
          'SSM Status:',
          result.ssmStatus,
        );
        // Heartbeat will be started in syncPosition
      } else {
        this.setSsmStatus(null);
        this.activeZoneName = null;
        this.lastStartFailed = true;
        this.lastStartFailedZoneName = zone.name;
        console.log(
          '[Preemption] START failed for zone:',
          zone.name,
          '- API unreachable or returned invalid response',
        );
      }
    });
    if (!result) this.scheduleStartFailedExpiry();

    // Fetch the dashboard's configured duration bounds for PreemptionCountdown
    // once per grant — fire-and-forget, not awaited, since it must never delay
    // showing "granted." Guarded on sessionId so a slow response can't clobber
    // a newer session's state if the driver has already left/re-entered by
    // the time it resolves.
    if (result && result.ssmStatus === 'granted') {
      const sessionId = result.sessionId;
      PreemptionConfigService.fetchTimingBounds(config.id).then((bounds) => {
        runInAction(() => {
          if (this.sessionId === sessionId) this.timingBounds = bounds;
        });
      });
    }
  }

  private scheduleStartFailedExpiry(): void {
    if (this.startFailedTimeout) {
      clearTimeout(this.startFailedTimeout);
    }
    this.startFailedTimeout = setTimeout(() => {
      this.startFailedTimeout = null;
      runInAction(() => {
        this.lastStartFailed = false;
        this.lastStartFailedZoneName = null;
      });
    }, PreemptionViewModel.START_FAILED_DISPLAY_MS);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatCycleStart = Date.now();

    // Main heartbeat every 1.5 s
    this.heartbeatInterval = setInterval(() => {
      if (this.sessionId && this.insideZone && this.isEnabled) {
        this.callHeartbeat(this.sessionId);

        // Re-post position on the same cadence so the dashboard's map shows
        // real-time movement through the zone, not just a single ping at
        // entry. previousPosition is kept current by every syncPosition()
        // call (GPS updates), independent of this timer.
        const config = this.trackedZoneId ? this.configCache.get(this.trackedZoneId) : null;
        if (config && config.signalGroup !== null) {
          const laneId =
            Array.isArray(config.laneIds) && config.laneIds.length > 0 ? config.laneIds[0] : 0;
          const srmPayload = PreemptionApiService.buildSrmPayload(
            config.intersectionId,
            config.signalGroup,
            laneId,
          );
          this.postNv2xSrm(config, srmPayload);
        }

        // Reset cycle so the progress bar restarts from 0
        runInAction(() => {
          this.heartbeatCycleStart = Date.now();
        });
      }
    }, 1500);

    // Stale-feed check only, at a coarse cadence — feedStale drives
    // PreemptionStatusBanner's "connection lost" state.
    this.staleCheckInterval = setInterval(() => {
      runInAction(() => {
        this.feedStale =
          this.lastHeartbeatSuccessAt !== null &&
          Date.now() - this.lastHeartbeatSuccessAt > PreemptionViewModel.HEARTBEAT_STALE_MS;
      });
    }, 1000);

    console.log('[Preemption] Heartbeat started (1.5 second interval)');
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatInterval && !this.staleCheckInterval) return;
    clearInterval(this.heartbeatInterval!);
    clearInterval(this.staleCheckInterval!);
    this.heartbeatInterval = null;
    this.staleCheckInterval = null;
    this.heartbeatCycleStart = null;
    this.lastHeartbeatSuccessAt = null;
    runInAction(() => { this.feedStale = false; });
    console.log('[Preemption] Heartbeat stopped');
  }

  private onZoneExit(): void {
    if (!this.sessionId) return;

    console.log('[Preemption] Zone EXIT detected - Clearing preemption session');
    this.clearSession();
  }

  private clearSession(): void {
    if (!this.sessionId) return;

    const sessionId = this.sessionId;
    console.log('[Preemption] Calling /preempt/clear for session:', sessionId);

    // Stop heartbeat
    this.stopHeartbeat();

    // Call CLEAR
    this.callClear(sessionId);

    // Reset here (not just at declaration) so a stale confirmation result
    // from a previous zone's clear can't briefly show through before this
    // clear's own response arrives.
    this.lastClearConfirmed = null;
    this.lastClearZoneName = this.activeZoneName;

    // Reset session state
    this.sessionId = null;
    this.setSsmStatus(null);
    this.activeZoneName = null;
    this.requestedSignalGroup = null;
    this.requestedPreemptChannel = null;
    this.controllerSignalState = null;

    console.log('[Preemption] Session cleared');
  }

  // ============ Config Sync ============

  private async syncConfigsWithDashboard(): Promise<void> {
    if (this.configCache.size === 0) return;

    // The dashboard API requires intersection_id per request, and cached zones
    // may span more than one intersection (a tester can pass through several
    // during a session), so fetch per intersection rather than one global call.
    const intersectionIds = Array.from(
      new Set(Array.from(this.configCache.values()).map((c) => c.intersectionId)),
    );

    const perIntersection = await Promise.all(
      intersectionIds.map(async (intersectionId) => ({
        intersectionId,
        configs: await PreemptionConfigService.fetchAllConfigs(intersectionId),
      })),
    );

    const freshById = new Map<string, PreemptionZoneConfig>();
    const verifiedIntersectionIds = new Set<number>();

    for (const { intersectionId, configs } of perIntersection) {
      if (configs === null) continue; // fetch failed — skip deletion check for this intersection's zones
      verifiedIntersectionIds.add(intersectionId);
      for (const config of configs) {
        freshById.set(config.spatZoneId, config);
      }
    }

    for (const [zoneId, cached] of this.configCache) {
      if (!verifiedIntersectionIds.has(cached.intersectionId)) continue; // couldn't verify this cycle
      if (!freshById.has(zoneId)) {
        console.log('[Preemption] Zone config deleted from dashboard:', zoneId);
        this.configCache.delete(zoneId);

        if (this.trackedZoneId === zoneId && this.sessionId) {
          console.log('[Preemption] Active zone was deleted — clearing session');
          runInAction(() => { this.clearSession(); });
        }
      }
    }

    // Refresh any cached configs that are still present
    for (const [zoneId, config] of freshById) {
      if (this.configCache.has(zoneId)) {
        this.configCache.set(zoneId, config);
      }
    }
  }

  // ============ API Calls (Mocks for now) ============

  private async postNv2xSrm(config: PreemptionZoneConfig, srm: SrmPayload): Promise<void> {
    if (!config.nv2xSlug) {
      console.log('[Preemption] Skipping N-V2X SRM ingest — no nv2x_slug configured for zone:', config.name);
      return;
    }
    const position = this.previousPosition;
    if (!position) return;

    const [lat, lon] = position;
    const payload = PreemptionApiService.buildNv2xIngestPayload(config.nv2xSlug, lat, lon, srm);
    console.log('[Preemption] POST N-V2X SRM ingest:', JSON.stringify(payload));

    try {
      const response = await fetch(API_CONFIG.NV2X_SRM_INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[Preemption] N-V2X SRM ingest response status:', response.status);
    } catch (error) {
      // Non-critical — the dashboard visualization lagging or missing a
      // beat must never block or fail the actual preemption request.
      console.log('[Preemption] N-V2X SRM ingest failed (non-critical):', error);
    }
  }

  private async callStart(payload: SrmPayload): Promise<{ sessionId: string; ssmStatus: 'granted' | 'cancelled' } | null> {
    console.log('[API] POST /preempt/start');
    console.log('[API] Request body:', JSON.stringify(payload, null, 2));

    try {
      const result = await RetryService.withFetchRetry(
        async () =>
          fetch(
            `${API_CONFIG.PREEMPTION_API_URL}/preempt/start`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Host: API_CONFIG.PREEMPTION_HOST,
              },
              body: JSON.stringify({ srm_payload: payload }),
            },
          ),
        async (response) => {
          const data = await response.json();
          console.log('[API] START | ok:', data.ok, '| detail:', data.detail);
          console.log('[API] START | controller_ip:', data.controller_ip, '| preempt_channel:', data.preempt_channel, '| current_state:', data.current_state);
          console.log('[API] START | session_id:', data.session_id, '| ssm:', JSON.stringify(data.ssm));

          if (!data.session_id) {
            throw new Error('No session_id in response');
          }

          const ssmStatus = (data?.ssm?.value?.[1]?.status ?? 'granted') as 'granted' | 'cancelled';
          return { sessionId: data.session_id as string, ssmStatus };
        },
        { maxRetries: 3 },
      );

      return result;
    } catch (error) {
      console.log('[API] START failed after retries:', error);
      return null;
    }
  }

  private async callHeartbeat(sessionId: string): Promise<boolean> {
    console.log('[API] POST /preempt/heartbeat | session_id:', sessionId);

    try {
      await RetryService.withFetchRetry(
        async () =>
          fetch(
            `${API_CONFIG.PREEMPTION_API_URL}/preempt/heartbeat`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Host: API_CONFIG.PREEMPTION_HOST,
              },
              body: JSON.stringify({ session_id: sessionId }),
            },
          ),
        async (response) => {
          const data = await response.json();
          console.log('[API] HB | ok:', data.ok, '| detail:', data.detail, '| preempt_channel:', data.preempt_channel, '| current_state:', data.current_state);
          const status = data?.ssm?.value?.[1]?.status as 'granted' | 'cancelled' | undefined;
          if (status && status !== this.ssmStatus) {
            runInAction(() => { this.setSsmStatus(status); });
          }
          this.lastHeartbeatSuccessAt = Date.now();
          runInAction(() => {
            this.controllerSignalState = typeof data.current_state === 'number' ? data.current_state : null;
            this.feedStale = false;
          });
          return true;
        },
        { maxRetries: 2 }, // Heartbeat less critical than START
      );

      return true;
    } catch (error) {
      console.log('[API] Heartbeat failed after retries:', error);
      return false;
    }
  }

  private async callClear(sessionId: string): Promise<void> {
    console.log('[API] POST /preempt/clear');
    console.log('[API] Request body:', { session_id: sessionId });

    try {
      await RetryService.withFetchRetry(
        async () =>
          fetch(
            `${API_CONFIG.PREEMPTION_API_URL}/preempt/clear`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Host: API_CONFIG.PREEMPTION_HOST,
              },
              body: JSON.stringify({ session_id: sessionId }),
            },
          ),
        async (response) => {
          const data = await response.json();
          console.log('[API] CLEAR | ok:', data.ok, '| detail:', data.detail);
          runInAction(() => { this.lastClearConfirmed = data.ok === true; });
          return true;
        },
        { maxRetries: 2 }, // Clear less critical than START
      );
    } catch (error) {
      console.log('[API] Clear failed after retries:', error);
      runInAction(() => { this.lastClearConfirmed = false; });
    } finally {
      this.scheduleClearConfirmExpiry();
    }
  }

  private scheduleClearConfirmExpiry(): void {
    if (this.clearConfirmTimeout) {
      clearTimeout(this.clearConfirmTimeout);
    }
    this.clearConfirmTimeout = setTimeout(() => {
      this.clearConfirmTimeout = null;
      runInAction(() => {
        this.lastClearConfirmed = null;
        this.lastClearZoneName = null;
      });
    }, PreemptionViewModel.CLEAR_CONFIRM_DISPLAY_MS);
  }

  // Cleanup on unmount
  destroy(): void {
    if (this.configSyncInterval) {
      clearInterval(this.configSyncInterval);
      this.configSyncInterval = null;
    }
    if (this.sessionId) {
      this.clearSession();
    }
    this.stopHeartbeat();
    if (this.clearConfirmTimeout) {
      clearTimeout(this.clearConfirmTimeout);
      this.clearConfirmTimeout = null;
    }
    if (this.startFailedTimeout) {
      clearTimeout(this.startFailedTimeout);
      this.startFailedTimeout = null;
    }
    this.isPendingStart = false;
    this.exitCandidateStreak = 0;
    this.configCache.clear();
  }
}

export default PreemptionViewModel;
