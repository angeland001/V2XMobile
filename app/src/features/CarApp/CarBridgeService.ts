import { NativeModules, Platform } from 'react-native';
import { reaction } from 'mobx';
import { SpatViewModel } from '../SpatService/viewModels/SpatViewModel';

export function startCarBridge(spatViewModel: SpatViewModel): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  console.log('[CarBridge] NativeModules.CarBridge present:', !!NativeModules.CarBridge);

  return reaction(
    () => [spatViewModel.signalStatusText, spatViewModel.signalColor, spatViewModel.currentIntersection] as const,
    ([statusText, color, intersection]) => {
      console.log('[CarBridge] pushing state', statusText, color, intersection);
      NativeModules.CarBridge?.updateSpatState(statusText, color, intersection ?? '');
    },
    { fireImmediately: true }
  );
}
