// app/src/features/preemption/components/PreemptionCountdown.tsx
//
// Real "time remaining" countdown for an active, granted preemption session —
// a separate component from PreemptionStatusBanner (rendered above it), since
// it answers a different question ("how much longer") than the banner's own
// request/grant/clear lifecycle status. Backed by the dashboard's configured
// NTCIP maxOut_s/minDuration_s bounds (PreemptionViewModel.timingBounds), not
// the live SPaT feed — see PreemptionViewModel/MapView comments on why the
// SPaT feed alone isn't safe for this. Renders nothing at all when those
// bounds aren't available, rather than showing a partial/blank countdown.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';
import { ROUTE_COLORS, ROUTE_FONTS } from '../../UI/appTheme';
import { useElapsedSeconds } from '../hooks/useElapsedSeconds';

interface PreemptionCountdownProps {
  // isPreempting && ssmStatus === 'granted' (and the banner-enabled setting) —
  // computed by the caller, same gating convention as PreemptionStatusBanner.
  active: boolean;
  grantedAt: number | null;
  minDurationS: number | null;
  maxOutS: number | null;
  top?: number;
  left?: number;
  bottom?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const PreemptionCountdown: React.FC<PreemptionCountdownProps> = ({
  active,
  grantedAt,
  minDurationS,
  maxOutS,
  top,
  left = 16,
  bottom,
  onLayout,
}) => {
  const { isTablet } = useResponsiveLayout();

  // maxOutS === null covers both "not fetched yet" and "this zone has no
  // controller/timing data configured" — either way there's no total to
  // count down against, so show nothing rather than a broken/blank number.
  const showCountdown = active && maxOutS !== null;
  const elapsedSeconds = useElapsedSeconds(showCountdown, grantedAt);

  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showCountdown || !maxOutS) {
      fillAnim.setValue(0);
      return;
    }
    const fraction = Math.min(1, elapsedSeconds / maxOutS);
    // Progress bar fill: transform (scaleX), not width — animating width
    // triggers layout on every tick, scaleX doesn't.
    Animated.timing(fillAnim, {
      toValue: fraction,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [elapsedSeconds, maxOutS, showCountdown, fillAnim]);

  if (!showCountdown || maxOutS === null) return null;

  const remaining = Math.max(0, Math.ceil(maxOutS - elapsedSeconds));

  return (
    <View
      style={[
        styles.wrapper,
        { left },
        top !== undefined ? { top } : { bottom: bottom ?? 100 },
      ]}
      onLayout={onLayout}
    >
      <View
        style={[styles.card, isTablet && styles.cardTablet]}
        accessible
        accessibilityLabel={
          minDurationS !== null
            ? `Priority active. ${remaining} seconds remaining of ${maxOutS} second maximum.`
            : `Priority active. ${remaining} seconds remaining.`
        }
      >
        <Text style={[styles.label, isTablet && styles.labelTablet]}>PRIORITY ACTIVE</Text>
        <View style={styles.numeralRow}>
          <Text style={[styles.remaining, isTablet && styles.remainingTablet]}>
            {formatRemaining(remaining)}
          </Text>
          <Text style={[styles.maxLabel, isTablet && styles.maxLabelTablet]}>
            of {formatRemaining(maxOutS)} max
          </Text>
        </View>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                transform: [
                  {
                    scaleX: fillAnim,
                  },
                ],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    zIndex: 1000,
  },
  card: {
    backgroundColor: 'rgba(27, 29, 34, 0.88)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${ROUTE_COLORS.signal}55`,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 150,
  },
  cardTablet: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 190,
  },
  label: {
    fontFamily: ROUTE_FONTS.displaySemiBold,
    color: ROUTE_COLORS.signal,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  labelTablet: {
    fontSize: 13,
  },
  numeralRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  remaining: {
    fontFamily: ROUTE_FONTS.monoSemiBold,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 24,
  },
  remainingTablet: {
    fontSize: 30,
  },
  maxLabel: {
    fontFamily: ROUTE_FONTS.mono,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginLeft: 8,
  },
  maxLabelTablet: {
    fontSize: 12,
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
    borderRadius: 1.5,
    backgroundColor: ROUTE_COLORS.signal,
    transformOrigin: 'left',
  },
});

export default PreemptionCountdown;
