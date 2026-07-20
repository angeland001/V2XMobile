import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { observer } from 'mobx-react-lite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimService } from '../../TIM/services/TimService';
import { RouteViewModel } from '../../Route/viewmodels/RouteViewModel';
import { SettingsViewModel } from '../viewmodels/SettingsViewModel';

type TimCategory = 'safety' | 'regulatory' | 'informational';

// Solid, saturated per-category background (not a neutral black/dark card) —
// legibility comes from three redundant signals instead of one: fixed white
// text with a hard drop-shadow (holds up even if a background render glitch
// ever washes out the fill), a bold category color, and the icon+label pair.
// All three text colors below sit at >= 5:1 contrast against their card.
const TEXT_COLOR = '#FFFFFF';

const CATEGORY_STYLE: Record<TimCategory, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  bg: string;
  border: string;
}> = {
  safety:        { icon: 'warning',            label: 'Safety',      bg: '#B91C1C', border: '#FCA5A5' },
  regulatory:    { icon: 'ban',                 label: 'Regulatory',  bg: '#92400E', border: '#FCD34D' },
  informational: { icon: 'information-circle',  label: 'Info',        bg: '#1D4ED8', border: '#93C5FD' },
};

interface DisplayItem {
  key: string;
  category: TimCategory;
  message: string;
  distanceM: number | null;
  persistent: boolean; // true = stays until condition clears; false = auto-dismiss
}

function formatDistanceMeters(m: number): string {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.round(ft / 50) * 50 || Math.round(ft)} ft`;
  const mi = m / 1609.34;
  return `${mi.toFixed(1)} mi`;
}

interface TimAlertCardProps {
  item: DisplayItem;
  onAutoDismiss?: () => void;
  onDismiss?: () => void;
}

// Ephemeral (ambient) cards read time scales with message length so a longer
// description isn't cut off mid-read; clamped to a sane min/max either way.
const MIN_AUTO_DISMISS_MS = 2200;
const MAX_AUTO_DISMISS_MS = 6000;
const MS_PER_CHAR = 60;
function computeAutoDismissMs(messageLength: number): number {
  return Math.min(MAX_AUTO_DISMISS_MS, Math.max(MIN_AUTO_DISMISS_MS, messageLength * MS_PER_CHAR));
}

// Safety zones this close get a heavier border instead of the flat
// treatment used the rest of the approach.
const URGENT_DISTANCE_M = 150;

// Card enters/exits from off the left edge of the screen (container is left-anchored).
const OFFSCREEN_X = -320;

const TimAlertCard: React.FC<TimAlertCardProps> = ({ item, onAutoDismiss, onDismiss }) => {
  const translateX = useSharedValue(OFFSCREEN_X);
  const opacity = useSharedValue(0);

  // Plain (non-worklet) conditional style, not a reanimated shared value —
  // the card's actual content sits in a plain View precisely so it renders
  // correctly even if reanimated worklets are misbehaving (this repo has no
  // babel.config.js registering the reanimated plugin). Only the outer
  // entrance/exit slide, which doesn't gate content visibility, uses reanimated.
  const isUrgent = item.category === 'safety' && item.distanceM != null && item.distanceM <= URGENT_DISTANCE_M;

  // Keyed on item.key by the parent list, so this effect only re-fires the
  // entrance animation when a genuinely new zone appears, not on every tick.
  useEffect(() => {
    translateX.value = OFFSCREEN_X;
    opacity.value = 0;
    translateX.value = withSpring(0, { damping: 16, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 200 });

    if (!item.persistent && onAutoDismiss) {
      const timer = setTimeout(() => {
        translateX.value = withTiming(OFFSCREEN_X, { duration: 280, easing: Easing.in(Easing.cubic) });
        opacity.value = withTiming(0, { duration: 280 }, (finished) => {
          if (finished) runOnJS(onAutoDismiss)();
        });
      }, computeAutoDismissMs(item.message.length));
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const cfg = CATEGORY_STYLE[item.category];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onDismiss} disabled={!onDismiss}>
        <View style={[styles.alert, { backgroundColor: cfg.bg, borderColor: cfg.border, borderWidth: isUrgent ? 3 : 1 }]}>
          <View style={styles.iconWrap}>
            <Ionicons name={cfg.icon} size={15} color={TEXT_COLOR} />
          </View>
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>
                {cfg.label.toUpperCase()}
              </Text>
              {item.distanceM != null && (
                <Text style={styles.distance}>{formatDistanceMeters(item.distanceM)} ahead</Text>
              )}
            </View>
            <Text style={styles.description} numberOfLines={2}>{item.message}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

interface TimToastProps {
  timService: TimService;
  routeViewModel: RouteViewModel;
  settingsViewModel: SettingsViewModel;
  isNavigating?: boolean;
}

// Gap below the real (measured) NavigationBanner height, and below the
// SearchBar/legend row when not navigating — keeps the toast clear of both
// without hardcoding a guessed banner height.
const NAV_BANNER_GAP = 16;
const AMBIENT_TOP_OFFSET = 90;
const MAX_VISIBLE = 2;

export const TimToast: React.FC<TimToastProps> = observer(
  ({ timService, routeViewModel, settingsViewModel, isNavigating = false }) => {
    const insets = useSafeAreaInsets();
    // Nav-mode cards are persistent (computed fresh from the route each tick,
    // not a dismissable queue) — track user-dismissed keys locally so a tap
    // can hide one without waiting for the user to enter or leave the zone.
    const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

    const categoryEnabled = (category: TimCategory): boolean =>
      (category === 'safety' && settingsViewModel.safetyAlerts) ||
      (category === 'regulatory' && settingsViewModel.regulatoryAlerts) ||
      (category === 'informational' && settingsViewModel.informationalAlerts);

    // Ambient toast (not navigating): ephemeral, drains TimService.toastQueue.
    const ambientToast = !isNavigating ? timService.toastQueue[0] ?? null : null;

    useEffect(() => {
      if (!ambientToast) return;
      if (!categoryEnabled(ambientToast.category)) timService.dismissToast(ambientToast.id);
    }, [ambientToast?.id, settingsViewModel.safetyAlerts, settingsViewModel.regulatoryAlerts, settingsViewModel.informationalAlerts]);

    let rawItems: DisplayItem[];
    if (isNavigating) {
      // Persistent: stays until the route no longer crosses the zone or the user enters it.
      rawItems = routeViewModel.approachingTimZones
        .filter((hit) => categoryEnabled(hit.category))
        .sort((a, b) => (routeViewModel.approachingTimZoneDistancesM.get(a.timId) ?? Infinity) -
                        (routeViewModel.approachingTimZoneDistancesM.get(b.timId) ?? Infinity))
        .slice(0, MAX_VISIBLE)
        .map((hit) => ({
          key: `route-${hit.timId}`,
          category: hit.category,
          // `??` only catches null/undefined — the API can send an empty
          // string too, which would otherwise render as blank text.
          message: hit.description || `${hit.timType} ahead`,
          distanceM: routeViewModel.approachingTimZoneDistancesM.get(hit.timId) ?? null,
          persistent: true,
        }));
    } else if (ambientToast && categoryEnabled(ambientToast.category)) {
      const distanceMi = timService.timDistances.get(ambientToast.timId);
      rawItems = [{
        key: ambientToast.id,
        category: ambientToast.category,
        message: ambientToast.message,
        distanceM: distanceMi != null ? distanceMi * 1609.34 : null,
        persistent: false,
      }];
    } else {
      rawItems = [];
    }

    // A dismissed key stops being suppressed once its zone drops out of the
    // live list — so tapping away today's approach doesn't silence a later one.
    const rawKeys = rawItems.map((i) => i.key).join(',');
    useEffect(() => {
      const liveKeys = new Set(rawKeys ? rawKeys.split(',') : []);
      setDismissedKeys((prev) => {
        if ([...prev].every((k) => liveKeys.has(k))) return prev;
        return new Set([...prev].filter((k) => liveKeys.has(k)));
      });
    }, [rawKeys]);

    const items = rawItems.filter((item) => !dismissedKeys.has(item.key));

    if (items.length === 0) return null;

    const dismiss = (key: string): void => {
      setDismissedKeys((prev) => new Set(prev).add(key));
    };

    const baseTop = isNavigating
      ? routeViewModel.navBannerHeightPx + NAV_BANNER_GAP
      : insets.top + AMBIENT_TOP_OFFSET;

    return (
      <View
        style={[
          styles.container,
          { top: baseTop + routeViewModel.topHudExtraPx },
        ]}
        pointerEvents="box-none"
      >
        {items.map((item) => (
          <TimAlertCard
            key={item.key}
            item={item}
            onAutoDismiss={!item.persistent ? () => timService.dismissToast(item.key) : undefined}
            onDismiss={() => (item.persistent ? dismiss(item.key) : timService.dismissToast(item.key))}
          />
        ))}
      </View>
    );
  },
);

const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.55)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

// Fixed (not max-) width: `container` is position:'absolute' with no
// `right`, so without a definite width here, Yoga has nothing to resolve
// the nested `flex: 1` on textWrap against — it collapses to zero width
// and every Text inside becomes genuinely invisible, independent of color.
const CARD_WIDTH = 280;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    width: CARD_WIDTH,
    gap: 8,
    zIndex: 9999,
  },
  alert: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 11,
    gap: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: TEXT_COLOR,
    ...TEXT_SHADOW,
  },
  distance: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_COLOR,
    ...TEXT_SHADOW,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    ...TEXT_SHADOW,
  },
});

export default TimToast;
