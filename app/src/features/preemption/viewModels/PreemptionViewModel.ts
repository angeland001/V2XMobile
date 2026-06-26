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
  heartbeatProgress = 0; // 0–1, cycles every 1.5 s while heartbeat is running

  private previousPosition: [number, number] | null = null;
  private wasInsideZone = false;
  private validEntry = false;
  private trackedZoneId: string | null = null;
  private isPendingStart = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private heartbeatCycleStart: number | null = null;

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

      if (comingFromZone && currentZone !== undefined) {
        // Zone-to-zone transition: re-trigger entry detection for new zone.
        // previousPosition is already inside the new zone so the entry line check
        // cannot run — allow the start (validEntry = true).
        this.wasInsideZone = false;
        this.validEntry = true;
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
          this.heartbeatProgress = 0;
          this.heartbeatCycleStart = Date.now();
        });
      }
    }, 1500);

    // Progress ticker at 10 Hz — drives the progress bar in the UI
    this.progressInterval = setInterval(() => {
      if (this.heartbeatCycleStart === null) return;
      const elapsed = Date.now() - this.heartbeatCycleStart;
      runInAction(() => {
        this.heartbeatProgress = Math.min(1, elapsed / 1500);
      });
    }, 100);

    console.log('[Preemption] Heartbeat started (1.5 second interval)');
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatInterval && !this.progressInterval) return;
    clearInterval(this.heartbeatInterval!);
    clearInterval(this.progressInterval!);
    this.heartbeatInterval = null;
    this.progressInterval = null;
    this.heartbeatCycleStart = null;
    runInAction(() => { this.heartbeatProgress = 0; });
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

    // Reset session state
    this.sessionId = null;
    this.ssmStatus = null;
    this.activeZoneName = null;
    this.validEntry = false;

    console.log('[Preemption] Session cleared');
  }

  // ============ Config Sync ============

  private async syncConfigsWithDashboard(): Promise<void> {
    if (this.configCache.size === 0) return;

    const freshConfigs = await PreemptionConfigService.fetchAllConfigs();
    if (freshConfigs === null) return; // skip deletion when fetch fails
    const freshIds = new Set(freshConfigs.map((c) => c.spatZoneId));

    for (const [zoneId] of this.configCache) {
      if (!freshIds.has(zoneId)) {
        console.log('[Preemption] Zone config deleted from dashboard:', zoneId);
        this.configCache.delete(zoneId);

        if (this.trackedZoneId === zoneId && this.sessionId) {
          console.log('[Preemption] Active zone was deleted — clearing session');
          runInAction(() => { this.clearSession(); });
        }
      }
    }

    // Refresh any cached configs that are still present
    for (const config of freshConfigs) {
      if (this.configCache.has(config.spatZoneId)) {
        this.configCache.set(config.spatZoneId, config);
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
          return true;
        },
        { maxRetries: 2 }, // Clear less critical than START
      );
    } catch (error) {
      console.log('[API] Clear failed after retries:', error);
    }
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
    this.isPendingStart = false;
    this.zoneDetectionBuffer = [];
    this.configCache.clear();
  }
}

export default PreemptionViewModel;
