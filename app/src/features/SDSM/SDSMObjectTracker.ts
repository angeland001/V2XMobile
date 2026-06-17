// app/src/features/SDSM/SDSMObjectTracker.ts
import RNFS from 'react-native-fs';

/**
 * SDSM Object Tracker
 * Tracks API appearance timestamp and overlay timestamp for each object
 * Shows when objects appear in API vs when they get displayed
 */

interface SDSMObject {
  objectID: number;
  type: 'vehicle' | 'vru';
  timestamp: string;
  location: {
    type: string;
    coordinates: [number, number];
  };
}

interface SDSMResponse {
  intersectionID: string;
  intersection: string;
  timestamp: string;
  objects: SDSMObject[];
}

interface ObjectAppearance {
  objectId: number;
  apiTimestamp: string;
  overlayTimestamp: string | null;
}

class SDSMObjectTracker {
  private readonly API_URL =
    'http://roadaware.cuip.research.utc.edu/cv2x/latest/sdsm_events/MLK_Georgia';
  private readonly TRACKING_DURATION_MS = 300000; // 5 minutes
  private readonly POLL_INTERVAL_MS = 500; // Poll twice per second
  private readonly START_DELAY_MS = 10000; // Wait 10 seconds

  private appearances: ObjectAppearance[] = [];
  private recentObjects: Map<number, number> = new Map(); // objectId -> index in appearances array
  private isTracking = false;
  private hasRun = false;
  private pollIntervalId: NodeJS.Timeout | null = null;
  private endTimeoutId: NodeJS.Timeout | null = null;
  private startTimeoutId: NodeJS.Timeout | null = null;

  /** Initialize tracking */
  public initializeTracking(): void {
    if (this.hasRun) {
      console.log('[SDSMTracker] Tracking already completed, skipping...');
      return;
    }
    if (this.isTracking) {
      console.log('[SDSMTracker] Tracking already in progress');
      return;
    }

    console.log('[SDSMTracker] Tracking will start in 10 seconds...');
    console.log('[SDSMTracker] Current time:', this.formatTime(Date.now()));
    
    this.startTimeoutId = setTimeout(() => {
      this.startTracking();
    }, this.START_DELAY_MS);
  }

  /** Start tracking */
  private startTracking(): void {
    if (this.hasRun || this.isTracking) return;

    console.log('[SDSMTracker] ========================================');
    console.log('[SDSMTracker] Starting 5-minute tracking session');
    console.log('[SDSMTracker] Start time:', this.formatTime(Date.now()));
    console.log('[SDSMTracker] ========================================');
    
    this.isTracking = true;
    this.appearances = [];
    this.recentObjects.clear();

    this.pollIntervalId = setInterval(() => this.pollAPI(), this.POLL_INTERVAL_MS);
    this.endTimeoutId = setTimeout(() => this.endTracking(), this.TRACKING_DURATION_MS);
  }

  /** Record overlay event from UI */
  public recordOverlayEvent(objectId: number): void {
    if (!this.isTracking) return;

    const overlayTime = this.formatTime(Date.now());
    
    // Find the most recent API appearance of this object that doesn't have an overlay yet
    const recentIndex = this.recentObjects.get(objectId);
    
    if (recentIndex !== undefined && recentIndex < this.appearances.length) {
      const appearance = this.appearances[recentIndex];
      
      if (!appearance.overlayTimestamp) {
        appearance.overlayTimestamp = overlayTime;
        console.log(`[SDSMTracker] 🎨 OVERLAY - Object ${objectId} at ${overlayTime}`);
      }
    } else {
      // Object overlaid but we haven't seen it in API yet (rare)
      // Create a placeholder entry
      const index = this.appearances.length;
      this.appearances.push({
        objectId,
        apiTimestamp: '',
        overlayTimestamp: overlayTime
      });
      this.recentObjects.set(objectId, index);
      console.log(`[SDSMTracker] 🎨 OVERLAY (before API) - Object ${objectId} at ${overlayTime}`);
    }
  }

  /** Poll the API */
  private async pollAPI(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(this.API_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return;
      }

      const data: SDSMResponse = await response.json();
      
      const receivedTime = this.formatTime(Date.now());
      this.processAPIResponse(data, receivedTime);
      
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.log('[SDSMTracker] Poll error:', error.message);
      }
    }
  }

  /** Process API response */
  private processAPIResponse(data: SDSMResponse, receivedTime: string): void {
    if (!data?.objects || !Array.isArray(data.objects)) return;

    for (const obj of data.objects) {
      // Create new appearance entry for this API poll
      const index = this.appearances.length;
      
      this.appearances.push({
        objectId: obj.objectID,
        apiTimestamp: receivedTime,
        overlayTimestamp: null
      });
      
      // Update the most recent index for this object
      this.recentObjects.set(obj.objectID, index);
      
      console.log(`[SDSMTracker] 📡 API - Object ${obj.objectID} at ${receivedTime}`);
    }
  }

  /** Stop tracking */
  private async endTracking(): Promise<void> {
    const endTime = this.formatTime(Date.now());
    
    console.log('[SDSMTracker] ========================================');
    console.log('[SDSMTracker] Session ended at:', endTime);
    console.log('[SDSMTracker] Generating CSV...');
    console.log('[SDSMTracker] ========================================');

    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    if (this.endTimeoutId) clearTimeout(this.endTimeoutId);

    this.pollIntervalId = this.endTimeoutId = null;
    this.isTracking = false;
    this.hasRun = true;

    await this.generateCSV();
  }

  /** Generate CSV */
  private async generateCSV(): Promise<void> {
    try {
      const csvRows: string[] = [];
      
      // Header
      csvRows.push('api_timestamp,overlay_timestamp,object_id');

      // Add all appearances
      for (const appearance of this.appearances) {
        const apiTime = appearance.apiTimestamp || '';
        const overlayTime = appearance.overlayTimestamp || '';
        csvRows.push(`${apiTime},${overlayTime},${appearance.objectId}`);
      }

      const csvContent = csvRows.join('\n');
      const fileTimestamp = this.getFileTimestamp();
      const filePath = `${RNFS.DocumentDirectoryPath}/sdsms_log_${fileTimestamp}.csv`;
      
      await RNFS.writeFile(filePath, csvContent, 'utf8');

      // Statistics
      const totalAppearances = this.appearances.length;
      const withOverlay = this.appearances.filter(a => a.overlayTimestamp !== null).length;
      const withoutOverlay = totalAppearances - withOverlay;
      const uniqueObjects = new Set(this.appearances.map(a => a.objectId)).size;

      console.log('[SDSMTracker] ========================================');
      console.log('[SDSMTracker] ✅ CSV FILE SAVED SUCCESSFULLY');
      console.log('[SDSMTracker] ========================================');
      console.log('[SDSMTracker] File:', filePath);
      console.log(`[SDSMTracker] Total API appearances: ${totalAppearances}`);
      console.log(`[SDSMTracker] - With overlay: ${withOverlay}`);
      console.log(`[SDSMTracker] - Without overlay: ${withoutOverlay}`);
      console.log(`[SDSMTracker] Unique objects: ${uniqueObjects}`);
      console.log('[SDSMTracker] ========================================');

      this.logFileInstructions(filePath);
      
    } catch (error) {
      console.error('[SDSMTracker] ❌ CSV generation failed:', error);
    }
  }

  /** File instructions */
  private logFileInstructions(filePath: string): void {
    console.log('\n[SDSMTracker] 📁 HOW TO GET YOUR CSV:');
    console.log('[SDSMTracker] ========================================');
    console.log('[SDSMTracker] Path:', filePath);
    console.log('[SDSMTracker]');
    console.log('[SDSMTracker] ANDROID:');
    console.log('[SDSMTracker]   adb pull', filePath);
    console.log('[SDSMTracker] ========================================\n');
  }

  /** Format timestamp */
  private formatTime(timestampMs: number): string {
    const date = new Date(timestampMs);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
  }

  /** Get file timestamp */
  private getFileTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /** Status helpers */
  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  public hasAlreadyRun(): boolean {
    return this.hasRun;
  }

  public getAppearanceCount(): number {
    return this.appearances.length;
  }

  public cleanup(): void {
    if (this.startTimeoutId) clearTimeout(this.startTimeoutId);
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    if (this.endTimeoutId) clearTimeout(this.endTimeoutId);
    this.startTimeoutId = this.pollIntervalId = this.endTimeoutId = null;
  }
}

// Singleton
const tracker = new SDSMObjectTracker();

export const startSDSMTracking = (): void => tracker.initializeTracking();
export const recordOverlayEvent = (objectId: number): void => tracker.recordOverlayEvent(objectId);
export const isTracking = (): boolean => tracker.isCurrentlyTracking();
export const hasTrackingCompleted = (): boolean => tracker.hasAlreadyRun();
export const getAppearanceCount = (): number => tracker.getAppearanceCount();

export default startSDSMTracking;