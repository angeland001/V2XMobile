import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SsmStatus } from '../models/PreemptionModels';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';
import { ROUTE_COLORS, ROUTE_FONTS } from '../../UI/appTheme';

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
  // True once /preempt/clear comes back confirmed for the session that just
  // ended. A rising edge on this flashes the "cleared" confirmation state
  // for FLASH_DISPLAY_MS — see useRisingEdgeFlash below — instead of the
  // banner just vanishing as if nothing happened, so "cleared" gets its own
  // visible moment the same way "requested" and "granted" already do.
  clearConfirmed?: boolean;
  // True in the window right after /preempt/start comes back
  // empty/errored — same rising-edge flash treatment as clearConfirmed.
  startFailed?: boolean;
  top?: number;
  left?: number;
  navOffset?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

type BannerState = 'requesting' | 'granted' | 'cancelled' | 'stale' | 'unconfirmed' | 'cleared' | 'failed';

// On the lab bench (same LAN as the controller) /preempt/start's response
// can come back in well under a second, so "requesting" flips to "granted"
// faster than a driver can actually read it — the flow (requested → granted
// → cleared) needs each step to hold on screen for at least this long
// before advancing, even if the underlying session already moved on.
// Doesn't delay hiding the banner (session end/clear) — only delays
// switching between two states that are both actively showing something.
const MIN_STATE_DWELL_MS = 600;

// How long the "cleared"/"failed" flashes self-dismiss after. Runs
// independently of PreemptionViewModel's own (much longer) 10s windows for
// lastClearConfirmed/lastStartFailed — those longer windows exist so a
// slow-to-arrive response still has time to land, not so the flash lingers.
const FLASH_DISPLAY_MS = 3000;

const STATE_CONFIG: Record<BannerState, {
  label: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  pulse: boolean;
}> = {
  requesting:  { label: 'PREEMPTION REQUESTED', color: ROUTE_COLORS.amber,   icon: 'radio-outline',           pulse: true },
  granted:     { label: 'PREEMPTION GRANTED',   color: ROUTE_COLORS.signal,  icon: 'checkmark-circle',        pulse: false },
  cancelled:   { label: 'PREEMPTION LOST',      color: ROUTE_COLORS.danger,  icon: 'close-circle',            pulse: false },
  stale:       { label: 'STATUS UNCONFIRMED',   color: ROUTE_COLORS.amber,   icon: 'help-circle-outline',     pulse: true },
  unconfirmed: { label: 'CLEAR NOT CONFIRMED',  color: ROUTE_COLORS.preempt, icon: 'alert-circle-outline',    pulse: false },
  cleared:     { label: 'PREEMPTION CLEARED',   color: ROUTE_COLORS.signal,  icon: 'checkmark-done-circle',   pulse: false },
  failed:      { label: 'REQUEST FAILED',       color: ROUTE_COLORS.danger,  icon: 'warning',                 pulse: false },
};

// True for FLASH_DISPLAY_MS after each rising edge of `trigger`, then false
// until the next rising edge. A falling edge upstream (new session started,
// or the ViewModel's own longer window expired) closes it immediately
// instead of waiting out the timer. Shared by the cleared/failed flashes
// below — both are one-off events, not an ongoing state to poll.
function useRisingEdgeFlash(trigger: boolean, durationMs: number): boolean {
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef(trigger);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = trigger;

    if (trigger && !prev) {
      setActive(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setActive(false);
      }, durationMs);
    } else if (!trigger) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setActive(false);
    }
  }, [trigger, durationMs]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return active;
}

export const PreemptionStatusBanner: React.FC<PreemptionStatusBannerProps> = ({
  ssmStatus = null,
  intersectionName,
  feedStale = false,
  clearUnconfirmed = false,
  clearConfirmed = false,
  startFailed = false,
  top,
  left = 16,
  navOffset = 0,
  onLayout,
}) => {
  const { isTablet } = useResponsiveLayout();

  const clearedFlashActive = useRisingEdgeFlash(clearConfirmed, FLASH_DISPLAY_MS);
  const failedFlashActive = useRisingEdgeFlash(startFailed, FLASH_DISPLAY_MS);

  // Priority: an active session's own state always wins over a leftover
  // clear/failure-related state — those only have something to say once
  // there's no live session to report instead. A failed request is checked
  // before a stale clear-confirmation since it's the more actionable of the
  // two (both can't be true at once in practice — they come from different
  // calls — but if they ever did, "the request itself failed" matters more).
  let state: BannerState | null = null;
  if (ssmStatus === 'requesting') state = 'requesting';
  else if (ssmStatus === 'granted') state = feedStale ? 'stale' : 'granted';
  else if (ssmStatus === 'cancelled') state = 'cancelled';
  else if (failedFlashActive) state = 'failed';
  else if (clearedFlashActive) state = 'cleared';
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
      <View style={[styles.card, isTablet && styles.cardTablet, { borderColor: `${config.color}55` }]}>
        <View style={[styles.accentBar, { backgroundColor: config.color }]} />
        <Animated.View
          style={[
            styles.iconWrap,
            isTablet && styles.iconWrapTablet,
            { backgroundColor: `${config.color}26` },
            config.pulse && { opacity: pulseAnim },
          ]}
        >
          <Ionicons name={config.icon} size={isTablet ? 18 : 14} color={config.color} />
        </Animated.View>
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
    backgroundColor: 'rgba(27, 29, 34, 0.88)',
    borderRadius: 6,
    paddingRight: 12,
    paddingVertical: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 230,
    overflow: 'hidden',
  },
  cardTablet: {
    borderRadius: 8,
    paddingRight: 16,
    paddingVertical: 11,
    maxWidth: 290,
  },
  // Left rail in the current state's color — an engineering-drawing-style
  // "flagged edge" that reads at a glance even before the label text does,
  // and doubles as a second, always-visible indicator alongside the icon.
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: 10,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 9,
  },
  iconWrapTablet: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  textColumn: {
    flexShrink: 1,
  },
  statusText: {
    fontFamily: ROUTE_FONTS.displaySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  statusTextTablet: {
    fontSize: 13,
  },
  nameText: {
    fontFamily: ROUTE_FONTS.mono,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    marginTop: 2,
  },
  nameTextTablet: {
    fontSize: 12,
  },
});

export default PreemptionStatusBanner;
