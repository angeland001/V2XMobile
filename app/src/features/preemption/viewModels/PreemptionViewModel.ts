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

  // Tracks the most recent successful start/heartbeat response. Drives
  // feedStale below, which callers use to detect a preempt bridge that has
  // gone quiet instead of continuing to show a live-looking status.
  private lastHeartbeatSuccessAt: number | null = null;
  feedStale = false;
  // Mirrors SpatWebSocketService.STALE_MS so both feeds use the same
  // definition of "stale" across the app.
  private static readonly HEARTBEAT_STALE_MS = 5000;

  private previousPosition: [number, number] | null = null;
  private wasInsideZone = false;
  private validEntry = false;
  private trackedZoneId: string | null = null;
  private isPendingStart = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private staleCheckInterval: NodeJS.Timeout | null = null;

  // GPS Debounce: require 3 consecutive samples in same zone to trigger change
  private zoneDetectionBuffer: string[] = [];
  private readonly DEBOUNCE_SAMPLE_COUNT = 3;

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

    // Find which zone (if any) user is currently in
    const currentZone = allZones.find((zone) =>
      SpatZoneService.isPointInZone(currentPosition, zone)
    );

    // GPS Debounce: add current zone to buffer
    const currentZoneId = currentZone?.id ?? 'none';
    this.zoneDetectionBuffer.push(currentZoneId);
    // Keep buffer size at most DEBOUNCE_SAMPLE_COUNT
    if (this.zoneDetectionBuffer.length > this.DEBOUNCE_SAMPLE_COUNT) {
      this.zoneDetectionBuffer.shift();
    }

    // Check if all samples in buffer match (zone is stable)
    const allSamplesMatch =
      this.zoneDetectionBuffer.length === this.DEBOUNCE_SAMPLE_COUNT &&
      this.zoneDetectionBuffer.every((id) => id === this.zoneDetectionBuffer[0]);

    // Zone changed → only reset tracking if debounce confirms the change
    if (allSamplesMatch && currentZoneId !== (this.trackedZoneId ?? 'none')) {
      console.log(
        `[Preemption] Zone change detected (debounced): ${this.trackedZoneId} → ${currentZoneId}`,
      );
      const comingFromZone = this.trackedZoneId !== null;
      this.trackedZoneId = currentZone?.id ?? null;
      this.zoneDetectionBuffer = [];

      if (comingFromZone) {
        // Leaving the old zone must clear its session regardless of whether the
        // new zone turns out to be a valid entry — justExited can't fire below
        // since isInsideZone stays true across a direct zone-to-zone hop.
        this.onZoneExit();
      }

      if (comingFromZone && currentZone !== undefined) {
        // Zone-to-zone transition: re-trigger entry detection for new zone,
        // but still validate direction against the new zone's own entry/exit
        // line rather than assuming every hop is a legitimate approach.
        this.wasInsideZone = false;
        const previousPosition = this.previousPosition;
        if (previousPosition) {
          const crossedEntry = SpatZoneService.crossesEntryLine(
            previousPosition,
            currentPosition,
            currentZone,
          );
          const crossedExit = SpatZoneService.crossesExitLine(
            previousPosition,
            currentPosition,
            currentZone,
          );
          this.validEntry = crossedEntry && !crossedExit;
        } else {
          this.validEntry = false;
        }
      }
      // Outside-to-zone: entry line validation already ran correctly on the first
      // zone sample. wasInsideZone, validEntry, and previousPosition are correct —
      // do not override them here.
    }

    const isInsideZone = currentZone !== undefined;
    const justEntered = !this.wasInsideZone && isInsideZone;
    const justExited = this.wasInsideZone && !isInsideZone;

    // Detect valid entry (via entry line)
    if (justEntered && currentZone) {
      const previousPosition = this.previousPosition;
      const hasEntryExitLines =
        Array.isArray(currentZone.entryLine) &&
        currentZone.entryLine.length === 2 &&
        Array.isArray(currentZone.exitLine) &&
        currentZone.exitLine.length === 2;

      if (
        hasEntryExitLines &&
        previousPosition &&
        previousPosition[0] !== 0 &&
        previousPosition[1] !== 0
      ) {
        const crossedEntry = SpatZoneService.crossesEntryLine(
          previousPosition,
          currentPosition,
          currentZone,
        );
        const crossedExit = SpatZoneService.crossesExitLine(
          previousPosition,
          currentPosition,
          currentZone,
        );
        this.validEntry = crossedEntry && !crossedExit;
      } else {
        this.validEntry = true;
      }
    }

    // Update zone state
    this.insideZone = isInsideZone;

    // Handle zone exit
    if (justExited) {
      this.onZoneExit();
    }

    // Trigger preemption START on valid entry (if toggle is ON and no active session)
    if (justEntered && this.validEntry && this.isEnabled && !this.sessionId && !this.isPendingStart && currentZone) {
      this.startPreemption(currentZone);
    }

    // Start heartbeat if inside zone with active session
    if (isInsideZone && this.sessionId && !this.heartbeatInterval) {
      this.startHeartbeat();
    }

    this.wasInsideZone = isInsideZone;
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
      this.ssmStatus = 'requesting';
      this.activeZoneName = zone.name;
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

    // Call START with SRM payload
    console.log('[Preemption] Calling /preempt/start for zone:', zone.name);
    const result = await this.callStart(srmPayload);
    runInAction(() => {
      this.isPendingStart = false;
      if (result) {
        this.sessionId = result.sessionId;
        this.ssmStatus = result.ssmStatus;
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
        this.ssmStatus = null;
        console.log(
          '[Preemption] START failed for zone:',
          zone.name,
          '- API unreachable or returned invalid response',
        );
      }
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatCycleStart = Date.now();

    // Main heartbeat every 1.5 s
    this.heartbeatInterval = setInterval(() => {
      if (this.sessionId && this.insideZone && this.isEnabled) {
        this.callHeartbeat(this.sessionId);
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
    this.ssmStatus = null;
    this.activeZoneName = null;
    this.validEntry = false;
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
            runInAction(() => { this.ssmStatus = status; });
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
    this.isPendingStart = false;
    this.zoneDetectionBuffer = [];
    this.configCache.clear();
  }
}

export default PreemptionViewModel;
