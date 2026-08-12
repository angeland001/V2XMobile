import { useWindowDimensions } from 'react-native';

export type SizeClass = 'phone' | 'wideCompact' | 'tablet';

// Galaxy Tab S10's short side is ~800dp logical; a rotated phone or car
// head-unit display stays well under this, so shortSide (not aspect ratio
// alone) is what distinguishes "actually a tablet" from "wide but small."
const TABLET_MIN_SHORT_SIDE = 700;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  const aspectWide = width > height * 1.3;

  const sizeClass: SizeClass =
    shortSide >= TABLET_MIN_SHORT_SIDE ? 'tablet' : aspectWide ? 'wideCompact' : 'phone';

  return {
    width,
    height,
    sizeClass,
    isTablet: sizeClass === 'tablet',
    isWide: aspectWide, // matches the existing car-HU heuristic, unchanged meaning
    markerScale: sizeClass === 'tablet' ? 1.5 : 1,
  };
}
