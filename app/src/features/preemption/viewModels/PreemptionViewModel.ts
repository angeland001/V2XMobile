import { makeAutoObservable, runInAction } from 'mobx';
import type { SpatZone } from '../../SpatService/services/SpatZoneService';
import { SpatZoneService } from '../../SpatService/services/SpatZoneService';
import type { PreemptionZoneConfig, SrmPayload } from '../models/PreemptionModels';
import { PreemptionApiService } from '../services/PreemptionApiService';
import { PreemptionConfigService } from '../services/PreemptionConfigService';
import { RetryService } from '../services/RetryService';

export class PreemptionViewModel {
  isEnabled = false;

  // Session state
  sessionId: string | null = null;
  insideZone = false;

  private previousPosition: [number, number] | null = null;
  private wasInsideZone = false;
  private validEntry = false;
  private trackedZoneId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // GPS Debounce: require 3 consecutive samples in same zone to trigger change
  private zoneDetectionBuffer: string[] = [];
  private readonly DEBOUNCE_SAMPLE_COUNT = 3;

  // Config Caching: cache preemption configs by spat_zone_id
  private configCache: Map<string, PreemptionZoneConfig> = new Map();

  constructor() {
    makeAutoObservable(this);
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
    if (allSamplesMatch && currentZoneId !== this.trackedZoneId) {
      console.log(
        `[Preemption] Zone change detected (debounced): ${this.trackedZoneId} → ${currentZoneId}`,
      );
      this.trackedZoneId = currentZone?.id ?? null;
      this.wasInsideZone = false;
      this.validEntry = false;
      this.previousPosition = null;
      // Clear buffer when zone changes
      this.zoneDetectionBuffer = [];
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
    if (justEntered && this.validEntry && this.isEnabled && !this.sessionId && currentZone) {
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
    if (this.sessionId) return;

    // Check cache first
    let config = this.configCache.get(zone.id);
    if (config) {
      console.log('[Preemption] Using cached config for zone:', zone.name);
    } else {
      // Fetch from backend if not in cache
      console.log('[Preemption] Fetching config from backend for zone:', zone.name);
      config = await PreemptionConfigService.fetchConfigBySpatZoneId(
        zone.id,
      );

      // Store in cache if found
      if (config) {
        this.configCache.set(zone.id, config);
        console.log('[Preemption] Cached config for zone:', zone.name);
      }
    }

    // Zone has no preemption config
    if (!config) {
      console.log('[Preemption] Zone has no preemption config:', zone.name);
      return;
    }

    if (config.signalGroup === null) {
      console.log('[Preemption] No signal group configured for zone:', zone.name);
      return;
    }

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

    // Call START with SRM payload
    console.log('[Preemption] Calling /preempt/start for zone:', zone.name);
    const sessionId = await this.callStart(srmPayload);
    runInAction(() => {
      if (sessionId) {
        this.sessionId = sessionId;
        console.log(
          '[Preemption] START successful. Zone:',
          zone.name,
          'Session ID:',
          sessionId,
        );
        // Heartbeat will be started in syncPosition
      } else {
        console.log(
          '[Preemption] START failed for zone:',
          zone.name,
          '- API unreachable or returned invalid response',
        );
      }
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return; // Already running
    }

    // Heartbeat every 1.5 seconds (within 1-2 second range)
    this.heartbeatInterval = setInterval(() => {
      if (this.sessionId && this.insideZone && this.isEnabled) {
        this.callHeartbeat(this.sessionId);
      }
    }, 1500);

    console.log('[Preemption] Heartbeat started (1.5 second interval)');
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Preemption] Heartbeat stopped');
    }
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
    this.validEntry = false;

    console.log('[Preemption] Session cleared');
  }

  // ============ API Calls (Mocks for now) ============

  private async callStart(payload: SrmPayload): Promise<string | null> {
    console.log('[API] POST /preempt/start');
    console.log('[API] Request body:', JSON.stringify(payload, null, 2));

    try {
      const sessionId = await RetryService.withFetchRetry(
        async () =>
          fetch(
            'http://roadaware.cuip.research.utc.edu/preemptapi/preempt/start',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ srm_payload: payload }),
            },
          ),
        async (response) => {
          const data = await response.json();
          console.log('[API] Response 200:', data);

          if (!data.session_id) {
            throw new Error('No session_id in response');
          }

          return data.session_id;
        },
        { maxRetries: 3 },
      );

      return sessionId;
    } catch (error) {
      console.log('[API] START failed after retries:', error);
      return null;
    }
  }

  private async callHeartbeat(sessionId: string): Promise<boolean> {
    // Only log occasionally to avoid spam
    if (Math.random() < 0.1) {
      console.log('[API] POST /preempt/heartbeat');
      console.log('[API] Request body:', { session_id: sessionId });
    }

    try {
      await RetryService.withFetchRetry(
        async () =>
          fetch(
            'http://roadaware.cuip.research.utc.edu/preemptapi/preempt/heartbeat',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ session_id: sessionId }),
            },
          ),
        async (response) => {
          const data = await response.json();
          if (Math.random() < 0.1) {
            console.log('[API] Response 200:', data);
          }
          return true;
        },
        { maxRetries: 2 }, // Heartbeat less critical than START
      );

      return true;
    } catch (error) {
      if (Math.random() < 0.1) {
        console.log('[API] Heartbeat failed after retries:', error);
      }
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
            'http://roadaware.cuip.research.utc.edu/preemptapi/preempt/clear',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({ session_id: sessionId }),
            },
          ),
        async (response) => {
          const data = await response.json();
          console.log('[API] Response 200:', data);
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
    if (this.sessionId) {
      this.clearSession();
    }
    this.stopHeartbeat();
    this.zoneDetectionBuffer = [];
    this.configCache.clear();
  }
}
