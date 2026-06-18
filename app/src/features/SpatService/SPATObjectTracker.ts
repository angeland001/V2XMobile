// // app/src/features/SpatService/SPATObjectTracker.ts
// import RNFS from 'react-native-fs';
// import { SignalState } from './models/SpatModels';

// /**
//  * SPAT Object Tracker
//  * Tracks API appearance timestamp and display timestamp for each signal state
//  * Shows when signals appear in API vs when they get displayed
//  * Includes state change detection
//  */

// interface SPATResponse {
//   phaseStatusGroupGreens?: number[];
//   phaseStatusGroupYellows?: number[];
//   phaseStatusGroupReds?: number[];
// }

// interface SignalAppearance {
//   signalGroup: number;
//   signalState: SignalState;
//   apiTimestamp: string;
//   displayTimestamp: string | null;
//   stateChanged: boolean; // TRUE when signal state changes, FALSE if same
// }

// class SPATObjectTracker {
//   private readonly API_URL =
//     'http://roadaware.cuip.research.utc.edu/cv2x/latest/mlk_spat_events/MLK_Georgia';
//   private readonly TRACKING_DURATION_MS = 300000; // 5 minutes
//   private readonly POLL_INTERVAL_MS = 500; // Poll twice per second

//   private appearances: SignalAppearance[] = [];
//   private recentSignals: Map<string, number> = new Map(); // signalKey -> index in appearances array
//   private lastKnownState: Map<number, SignalState> = new Map(); // signalGroup -> last state
//   private isTracking = false;
//   private hasRun = false;
//   private pollIntervalId: NodeJS.Timeout | null = null;
//   private endTimeoutId: NodeJS.Timeout | null = null;

//   /** Called when user enters SPAT zone - starts tracking */
//   public onUserEnteredZone(): void {
//     if (this.hasRun) {
//       console.log('[SPATTracker] Tracking already completed, skipping...');
//       return;
//     }
//     if (this.isTracking) {
//       console.log('[SPATTracker] Tracking already in progress');
//       return;
//     }

//     console.log('[SPATTracker] ========================================');
//     console.log('[SPATTracker] User entered SPAT zone - Starting tracking');
//     console.log('[SPATTracker] Focus: Georgia Lanes 4 & 5 (Signal Group 2)');
//     console.log('[SPATTracker] Start time:', this.formatTime(Date.now()));
//     console.log('[SPATTracker] ========================================');

//     this.startTracking();
//   }

//   /** Start tracking */
//   private startTracking(): void {
//     if (this.hasRun || this.isTracking) return;

//     this.isTracking = true;
//     this.appearances = [];
//     this.recentSignals.clear();
//     this.lastKnownState.clear();

//     this.pollIntervalId = setInterval(() => this.pollAPI(), this.POLL_INTERVAL_MS);
//     this.endTimeoutId = setTimeout(() => this.endTracking(), this.TRACKING_DURATION_MS);
//   }

//   /** Record display event from UI */
//   public recordDisplayEvent(signalGroup: number, signalState: SignalState): void {
//     if (!this.isTracking) return;

//     const displayTime = this.formatTime(Date.now());
//     const signalKey = `${signalGroup}-${signalState}`;

//     // Find the most recent API appearance of this signal that doesn't have a display yet
//     const recentIndex = this.recentSignals.get(signalKey);

//     if (recentIndex !== undefined && recentIndex < this.appearances.length) {
//       const appearance = this.appearances[recentIndex];

//       if (!appearance.displayTimestamp) {
//         appearance.displayTimestamp = displayTime;
//         const stateStr = appearance.stateChanged ? '(CHANGED)' : '';
//         console.log(`[SPATTracker] 🎨 DISPLAY - SG${signalGroup} ${SignalState[signalState]} ${stateStr} at ${displayTime}`);
//       }
//     } else {
//       // Signal displayed but we haven't seen it in API yet (rare)
//       // Create a placeholder entry
//       const index = this.appearances.length;
//       this.appearances.push({
//         signalGroup,
//         signalState,
//         apiTimestamp: '',
//         displayTimestamp: displayTime,
//         stateChanged: false
//       });
//       this.recentSignals.set(signalKey, index);
//       console.log(`[SPATTracker] 🎨 DISPLAY (before API) - SG${signalGroup} ${SignalState[signalState]} at ${displayTime}`);
//     }
//   }

//   /** Poll the API */
//   private async pollAPI(): Promise<void> {
//     try {
//       const controller = new AbortController();
//       const timeoutId = setTimeout(() => controller.abort(), 2000);

//       const response = await fetch(this.API_URL, {
//         method: 'GET',
//         signal: controller.signal,
//         headers: {
//           Accept: 'application/json',
//           'Cache-Control': 'no-cache'
//         }
//       });

//       clearTimeout(timeoutId);

//       if (!response.ok) {
//         return;
//       }

//       const data: SPATResponse = await response.json();

//       const receivedTime = this.formatTime(Date.now());
//       this.processAPIResponse(data, receivedTime);

//     } catch (error) {
//       if (error instanceof Error && error.name !== 'AbortError') {
//         console.log('[SPATTracker] Poll error:', error.message);
//       }
//     }
//   }

//   /** Process API response */
//   private processAPIResponse(data: SPATResponse, receivedTime: string): void {
//     if (!data) return;

//     const signalGroups = new Map<number, SignalState>();

//     // Extract greens
//     if (data.phaseStatusGroupGreens && Array.isArray(data.phaseStatusGroupGreens)) {
//       for (const group of data.phaseStatusGroupGreens) {
//         signalGroups.set(group, SignalState.GREEN);
//       }
//     }

//     // Extract yellows
//     if (data.phaseStatusGroupYellows && Array.isArray(data.phaseStatusGroupYellows)) {
//       for (const group of data.phaseStatusGroupYellows) {
//         signalGroups.set(group, SignalState.YELLOW);
//       }
//     }

//     // Extract reds
//     if (data.phaseStatusGroupReds && Array.isArray(data.phaseStatusGroupReds)) {
//       for (const group of data.phaseStatusGroupReds) {
//         signalGroups.set(group, SignalState.RED);
//       }
//     }

//     // Process each signal
//     for (const [signalGroup, signalState] of signalGroups.entries()) {
//       const signalKey = `${signalGroup}-${signalState}`;

//       // Check if state changed
//       const previousState = this.lastKnownState.get(signalGroup);
//       const stateChanged = previousState !== undefined && previousState !== signalState;

//       // Create new appearance entry for this API poll
//       const index = this.appearances.length;

//       this.appearances.push({
//         signalGroup,
//         signalState,
//         apiTimestamp: receivedTime,
//         displayTimestamp: null,
//         stateChanged
//       });

//       // Update the most recent index for this signal
//       this.recentSignals.set(signalKey, index);

//       // Update last known state
//       this.lastKnownState.set(signalGroup, signalState);

//       const stateStr = stateChanged ? '(CHANGED)' : '';
//       console.log(`[SPATTracker] 📡 API - SG${signalGroup} ${SignalState[signalState]} ${stateStr} at ${receivedTime}`);
//     }
//   }

//   /** Stop tracking */
//   private async endTracking(): Promise<void> {
//     const endTime = this.formatTime(Date.now());

//     console.log('[SPATTracker] ========================================');
//     console.log('[SPATTracker] Session ended at:', endTime);
//     console.log('[SPATTracker] Generating CSV...');
//     console.log('[SPATTracker] ========================================');

//     if (this.pollIntervalId) clearInterval(this.pollIntervalId);
//     if (this.endTimeoutId) clearTimeout(this.endTimeoutId);

//     this.pollIntervalId = this.endTimeoutId = null;
//     this.isTracking = false;
//     this.hasRun = true;

//     await this.generateCSV();
//   }

//   /** Generate CSV */
//   private async generateCSV(): Promise<void> {
//     try {
//       const csvRows: string[] = [];

//       // Header
//       csvRows.push('api_timestamp,display_timestamp,signal_group,signal_state,state_changed');

//       // Add all appearances
//       for (const appearance of this.appearances) {
//         const apiTime = appearance.apiTimestamp || '';
//         const displayTime = appearance.displayTimestamp || '';
//         const signalStateStr = SignalState[appearance.signalState];
//         const stateChangedStr = appearance.stateChanged ? 'TRUE' : 'FALSE';

//         csvRows.push(`${apiTime},${displayTime},${appearance.signalGroup},${signalStateStr},${stateChangedStr}`);
//       }

//       const csvContent = csvRows.join('\n');
//       const fileTimestamp = this.getFileTimestamp();
//       const filePath = `${RNFS.DocumentDirectoryPath}/spat_log_${fileTimestamp}.csv`;

//       await RNFS.writeFile(filePath, csvContent, 'utf8');

//       // Statistics
//       const totalAppearances = this.appearances.length;
//       const withDisplay = this.appearances.filter(a => a.displayTimestamp !== null).length;
//       const withoutDisplay = totalAppearances - withDisplay;
//       const stateChanges = this.appearances.filter(a => a.stateChanged).length;
//       const stateChangesDisplayed = this.appearances.filter(a => a.stateChanged && a.displayTimestamp !== null).length;
//       const uniqueSignals = new Set(this.appearances.map(a => `${a.signalGroup}-${SignalState[a.signalState]}`)).size;

//       console.log('[SPATTracker] ========================================');
//       console.log('[SPATTracker] ✅ CSV FILE SAVED SUCCESSFULLY');
//       console.log('[SPATTracker] ========================================');
//       console.log('[SPATTracker] File:', filePath);
//       console.log(`[SPATTracker] Total API appearances: ${totalAppearances}`);
//       console.log(`[SPATTracker] - With display: ${withDisplay}`);
//       console.log(`[SPATTracker] - Without display: ${withoutDisplay}`);
//       console.log(`[SPATTracker] State changes detected: ${stateChanges}`);
//       console.log(`[SPATTracker] - State changes displayed: ${stateChangesDisplayed}`);
//       console.log(`[SPATTracker] Unique signal states: ${uniqueSignals}`);
//       console.log('[SPATTracker] ========================================');

//       this.logFileInstructions(filePath);

//     } catch (error) {
//       console.error('[SPATTracker] ❌ CSV generation failed:', error);
//     }
//   }

//   /** File instructions */
//   private logFileInstructions(filePath: string): void {
//     console.log('\n[SPATTracker] 📁 HOW TO GET YOUR CSV:');
//     console.log('[SPATTracker] ========================================');
//     console.log('[SPATTracker] Path:', filePath);
//     console.log('[SPATTracker]');
//     console.log('[SPATTracker] ANDROID:');
//     console.log('[SPATTracker]   adb pull', filePath);
//     console.log('[SPATTracker] ========================================\n');
//   }

//   /** Format timestamp */
//   private formatTime(timestampMs: number): string {
//     const date = new Date(timestampMs);
//     const year = date.getFullYear();
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const day = String(date.getDate()).padStart(2, '0');
//     const hours = String(date.getHours()).padStart(2, '0');
//     const minutes = String(date.getMinutes()).padStart(2, '0');
//     const seconds = String(date.getSeconds()).padStart(2, '0');
//     const ms = String(date.getMilliseconds()).padStart(3, '0');

//     return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
//   }

//   /** Get file timestamp */
//   private getFileTimestamp(): string {
//     const now = new Date();
//     const year = now.getFullYear();
//     const month = String(now.getMonth() + 1).padStart(2, '0');
//     const day = String(now.getDate()).padStart(2, '0');
//     const hours = String(now.getHours()).padStart(2, '0');
//     const minutes = String(now.getMinutes()).padStart(2, '0');
//     const seconds = String(now.getSeconds()).padStart(2, '0');
//     return `${year}${month}${day}_${hours}${minutes}${seconds}`;
//   }

//   /** Status helpers */
//   public isCurrentlyTracking(): boolean {
//     return this.isTracking;
//   }

//   public hasAlreadyRun(): boolean {
//     return this.hasRun;
//   }

//   public getAppearanceCount(): number {
//     return this.appearances.length;
//   }

//   public cleanup(): void {
//     if (this.pollIntervalId) clearInterval(this.pollIntervalId);
//     if (this.endTimeoutId) clearTimeout(this.endTimeoutId);
//     this.pollIntervalId = this.endTimeoutId = null;
//   }
// }

// // Singleton
// const tracker = new SPATObjectTracker();

// export const onUserEnteredSPATZone = (): void => tracker.onUserEnteredZone();
// export const recordSPATDisplayEvent = (signalGroup: number, signalState: SignalState): void =>
//   tracker.recordDisplayEvent(signalGroup, signalState);
// export const isSPATTracking = (): boolean => tracker.isCurrentlyTracking();
// export const hasSPATTrackingCompleted = (): boolean => tracker.hasAlreadyRun();
// export const getSPATAppearanceCount = (): number => tracker.getAppearanceCount();

export default {};
