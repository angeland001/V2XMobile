import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { TABLET_MIN_SHORT_SIDE } from '../../features/UI/hooks/useResponsiveLayout';

// Locks the app to portrait on a phone; leaves tablets and the wide
// DHU/car-debug window free to rotate. shortSide is orientation-invariant
// (min of width/height is the same value regardless of current rotation),
// same trick useResponsiveLayout relies on for its own phone/tablet check.
export async function applyPhoneOrientationLock(): Promise<void> {
  try {
    const { width, height } = Dimensions.get('window');
    const shortSide = Math.min(width, height);

    if (shortSide < TABLET_MIN_SHORT_SIDE) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } else {
      await ScreenOrientation.unlockAsync();
    }
  } catch {
    // Silent — same pattern as other non-critical native calls in this app.
  }
}
