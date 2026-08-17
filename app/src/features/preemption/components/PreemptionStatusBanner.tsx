import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import type { SsmStatus } from '../models/PreemptionModels';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';

interface PreemptionStatusBannerProps {
  ssmStatus?: SsmStatus;
  intersectionName?: string;
  // True when the heartbeat feed has gone quiet for a while during an active
  // session — we can no longer vouch for "granted" being current, so the
  // banner downgrades to an explicit warning instead of continuing to show a
  // status we're not actually sure still holds.
  feedStale?: boolean;
  // True in the window right after the vehicle has left the zone if the
  // controller never confirmed the preempt clear — the session was torn
  // down on our end regardless, but the controller may still be mid-preempt.
  // Shown instead of letting the panel just quietly disappear as if
  // everything wrapped up cleanly.
  clearUnconfirmed?: boolean;
  top?: number;
  left?: number;
  navOffset?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

type BannerState = 'requesting' | 'granted' | 'cancelled' | 'stale' | 'unconfirmed';

// On the lab bench (same LAN as the controller) /preempt/start's response
// can come back in well under a second, so "requesting" flips to "granted"
// faster than a driver can actually read it — the flow (requested → granted
// → cleared) needs each step to hold on screen for at least this long
// before advancing, even if the underlying session already moved on.
// Doesn't delay hiding the banner (session end/clear) — only delays
// switching between two states that are both actively showing something.
const MIN_STATE_DWELL_MS = 600;

const STATE_CONFIG: Record<BannerState, { label: string; color: string; dotColor: string; pulse: boolean }> = {
  requesting: { label: 'PREEMPTION REQUESTED', color: '#FFD60A', dotColor: '#FFD60A', pulse: true },
  granted:    { label: 'PREEMPTION GRANTED',   color: '#30D158', dotColor: '#30D158', pulse: false },
  cancelled:  { label: 'PREEMPTION LOST',      color: '#FF3B30', dotColor: '#FF3B30', pulse: false },
  stale:      { label: 'STATUS UNCONFIRMED',   color: '#f59e0b', dotColor: '#f59e0b', pulse: true },
  unconfirmed:{ label: 'CLEAR NOT CONFIRMED',  color: '#f59e0b', dotColor: '#f59e0b', pulse: false },
};

export const PreemptionStatusBanner: React.FC<PreemptionStatusBannerProps> = ({
  ssmStatus = null,
  intersectionName,
  feedStale = false,
  clearUnconfirmed = false,
  top,
  left = 16,
  navOffset = 0,
  onLayout,
}) => {
  const { isTablet } = useResponsiveLayout();

  // Priority: an active session's own state always wins over a leftover
  // "clear not confirmed" warning from the previous one; that warning only
  // has something to say once there's no live session to report instead.
  let state: BannerState | null = null;
  if (ssmStatus === 'requesting') state = 'requesting';
  else if (ssmStatus === 'granted') state = feedStale ? 'stale' : 'granted';
  else if (ssmStatus === 'cancelled') state = 'cancelled';
  else if (clearUnconfirmed) state = 'unconfirmed';

  // What's actually rendered — trails `state` by up to MIN_STATE_DWELL_MS
  // when switching between two visible states, per the comment above.
  const [renderedState, setRenderedState] = useState<BannerState | null>(state);
  const renderedSinceRef = useRef<number>(Date.now());
  const pendingSwitchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingSwitchRef.current) {
      clearTimeout(pendingSwitchRef.current);
      pendingSwitchRef.current = null;
    }

    setRenderedState((current) => {
      if (state === current) return current;

      // Hiding, or appearing from nothing — nothing to dwell on yet.
      if (state === null || current === null) {
        renderedSinceRef.current = Date.now();
        return state;
      }

      const elapsed = Date.now() - renderedSinceRef.current;
      const wait = Math.max(0, MIN_STATE_DWELL_MS - elapsed);
      if (wait === 0) {
        renderedSinceRef.current = Date.now();
        return state;
      }

      pendingSwitchRef.current = setTimeout(() => {
        pendingSwitchRef.current = null;
        renderedSinceRef.current = Date.now();
        setRenderedState(state);
      }, wait);
      return current;
    });

    return () => {
      if (pendingSwitchRef.current) {
        clearTimeout(pendingSwitchRef.current);
        pendingSwitchRef.current = null;
      }
    };
  }, [state]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (renderedState && STATE_CONFIG[renderedState].pulse) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoopRef.current?.stop();
    };
  }, [renderedState]);

  if (!renderedState) return null;

  const config = STATE_CONFIG[renderedState];

  return (
    <View
      style={[
        styles.wrapper,
        { left },
        top !== undefined ? { top } : { bottom: 100 + navOffset },
      ]}
      onLayout={onLayout}
    >
      <View style={[styles.card, isTablet && styles.cardTablet]}>
        <Animated.View
          style={[
            styles.dot,
            isTablet && styles.dotTablet,
            { backgroundColor: config.dotColor },
            config.pulse && { opacity: pulseAnim },
          ]}
        />
        <View style={styles.textColumn}>
          <Text
            style={[styles.statusText, isTablet && styles.statusTextTablet, { color: config.color }]}
            numberOfLines={1}
          >
            {config.label}
          </Text>
          {intersectionName ? (
            <Text style={[styles.nameText, isTablet && styles.nameTextTablet]} numberOfLines={1}>
              {intersectionName}
            </Text>
          ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 30, 0.88)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 220,
  },
  cardTablet: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: 280,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotTablet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  textColumn: {
    flexShrink: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statusTextTablet: {
    fontSize: 13,
  },
  nameText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },
  nameTextTablet: {
    fontSize: 12,
  },
});

export default PreemptionStatusBanner;
