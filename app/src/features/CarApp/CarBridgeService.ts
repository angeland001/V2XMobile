import { NativeModules, Platform } from 'react-native';
import { reaction } from 'mobx';
import { PreemptionViewModel } from '../preemption/viewModels/PreemptionViewModel';

// Well under PreemptionMessageScreen.kt's BRIDGE_STALE_MS (8000ms), so a
// status that holds steady still keeps the native watchdog from flipping to
// "Status Unavailable" between real state changes.
const KEEPALIVE_INTERVAL_MS = 3000;

export function startPreemptionCarBridge(preemptionViewModel: PreemptionViewModel): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  const push = () => {
    const statusText = preemptionViewModel.carStatusText;
    const color = preemptionViewModel.carStatusColor;
    const zoneName = preemptionViewModel.carZoneName;
    console.log('[CarBridge] pushing preemption state', statusText, color, zoneName);
    NativeModules.CarBridge?.updatePreemptionState(statusText, color, zoneName);
  };

  const disposeReaction = reaction(
    () =>
      [
        preemptionViewModel.carStatusText,
        preemptionViewModel.carStatusColor,
        preemptionViewModel.carZoneName,
      ] as const,
    push,
    { fireImmediately: true }
  );

  // The reaction above only re-fires on a value change; without this, a
  // status that legitimately holds steady (e.g. sitting on "Preemption
  // Granted" waiting for the light) goes unpushed past BRIDGE_STALE_MS, and
  // the native screen wrongly reports "Status Unavailable" despite the feed
  // being alive.
  const keepaliveInterval = setInterval(push, KEEPALIVE_INTERVAL_MS);

  return () => {
    disposeReaction();
    clearInterval(keepaliveInterval);
  };
}
