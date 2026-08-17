import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, useColorScheme } from 'react-native';
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
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

type TimCategory = 'safety' | 'regulatory' | 'informational';

// The banner itself is neutral (white/dark, tracks the app's color scheme) —
// category is now signaled only through the icon and its tinted badge, not
// the whole card. Card colors below are the icon accent only.
const CATEGORY_STYLE: Record<TimCategory, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
}> = {
  safety:        { icon: 'warning',            label: 'Safety',      accent: '#DC2626' },
  regulatory:    { icon: 'ban',                 label: 'Regulatory',  accent: '#CA8A04' },
  informational: { icon: 'information-circle',  label: 'Info',        accent: '#2563EB' },
};

// Neutral banner chrome per color scheme — background, border, and text all
// come from here so the card itself carries no category color.
const THEME = {
  light: {
    bg: '#FFFFFF',
    border: '#E5E7EB',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    shadow: 'rgba(0,0,0,0.2)',
  },
  dark: {
    bg: '#1E2030',
    border: '#3A3D52',
    text: '#F5F6FA',
    textSecondary: '#A1A6BE',
    shadow: 'rgba(0,0,0,0.5)',
  },
} as const;

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
  isTablet?: boolean;
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

const TimAlertCard: React.FC<TimAlertCardProps> = ({ item, onAutoDismiss, onDismiss, isTablet = false }) => {
  const scheme = useColorScheme();
  const neutral = scheme === 'dark' ? THEME.dark : THEME.light;
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
        <View style={[styles.alert, { backgroundColor: neutral.bg, borderColor: neutral.border, borderWidth: isUrgent ? 3 : 1 }]}>
          <View style={[styles.iconWrap, isTablet && styles.iconWrapTablet, { backgroundColor: `${cfg.accent}26` }]}>
            <Ionicons name={cfg.icon} size={isTablet ? 19 : 15} color={cfg.accent} />
          </View>
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, isTablet && styles.titleTablet, { color: neutral.text, textShadowColor: neutral.shadow }]}>
                {cfg.label.toUpperCase()}
              </Text>
              {item.distanceM != null && (
                <Text style={[styles.distance, isTablet && styles.distanceTablet, { color: neutral.textSecondary, textShadowColor: neutral.shadow }]}>{formatDistanceMeters(item.distanceM)} ahead</Text>
              )}
            </View>
            <Text style={[styles.description, isTablet && styles.descriptionTablet, { color: neutral.text, textShadowColor: neutral.shadow }]} numberOfLines={2}>{item.message}</Text>
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

// Room reserved on the right for the Auto Preemption toggle / ETA chip
// stack (see MapView.tsx) while navigating on a phone — both anchor
// top-right in that state. The toast card is left-anchored, so shrinking
// it to stay clear of that column (instead of always rendering at the
// fixed CARD_WIDTH) is what keeps the two from overlapping on narrower
// phones.
const NAV_RIGHT_RESERVE_PX = 170;
const MIN_CARD_WIDTH = 200;

export const TimToast: React.FC<TimToastProps> = observer(
  ({ timService, routeViewModel, settingsViewModel, isNavigating = false }) => {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    // Same wide-car-display detection used across the nav HUD (see
    // NavigationBanner). On a car display: top-center while ambient
    // (browsing, no route) so it stays clear of the system nav bar at the
    // bottom; bottom-center once navigation is active, since the top band
    // is then occupied by NavigationBanner + PedestrianWarning.
    const isWide = screenWidth > screenHeight * 1.3;
    const { isTablet } = useResponsiveLayout();
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
    const top = baseTop + routeViewModel.topHudExtraPx;

    // Wide car displays (Android Auto / DHU) while navigating: forced all
    // the way down to the literal bottom edge. bottom:110 used to put this
    // centered card in the same vertical band as PreemptionStatusBanner
    // (bottom-left, wrapper bottom: 100 + navOffset) and ZoomControls
    // (bottom-right, container bottom: 110 + navOffset) — on the short,
    // wide DHU emulator screen that reads as sitting adjacent to both. This
    // takes priority over clearing the recenter button / status toast pair
    // MapView stacks at the same bottom-center spot (bottomCenterBaseline
    // 20) — those can be covered when a TIM alert is showing. Not
    // navigating: top-center, clear of the system nav bar at the bottom.
    // Phone card width: shrink below the CARD_WIDTH default so it never
    // reaches into the top-right toggle/ETA column while navigating (see
    // NAV_RIGHT_RESERVE_PX above), and never overflows a narrow screen the
    // rest of the time either.
    const cardWidth = isTablet ? TABLET_CARD_WIDTH : CARD_WIDTH;
    const phoneCardWidth = isNavigating
      ? Math.max(MIN_CARD_WIDTH, Math.min(cardWidth, screenWidth - 12 - NAV_RIGHT_RESERVE_PX))
      : Math.min(cardWidth, screenWidth - 24);

    const positionStyle = isWide
      ? (isNavigating
          ? { bottom: insets.bottom + 6, left: (screenWidth - cardWidth) / 2, width: cardWidth }
          : { top, left: (screenWidth - cardWidth) / 2, width: cardWidth })
      : { top, left: 12, width: phoneCardWidth };

    return (
      <View
        style={[styles.container, positionStyle]}
        pointerEvents="box-none"
      >
        {items.map((item) => (
          <TimAlertCard
            key={item.key}
            item={item}
            onAutoDismiss={!item.persistent ? () => timService.dismissToast(item.key) : undefined}
            onDismiss={() => (item.persistent ? dismiss(item.key) : timService.dismissToast(item.key))}
            isTablet={isTablet}
          />
        ))}
      </View>
    );
  },
);

// textShadowColor is supplied per-item (see `neutral.shadow`) since it must
// track the active color scheme to stay legible.
const TEXT_SHADOW = {
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 2,
} as const;

// Fixed (not max-) width: `container` is position:'absolute' with no
// `right`, so without a definite width here, Yoga has nothing to resolve
// the nested `flex: 1` on textWrap against — it collapses to zero width
// and every Text inside becomes genuinely invisible, independent of color.
const CARD_WIDTH = 280;
// Tablet keeps the toast floating (transient, not worth a persistent dock
// spot) but gives it more room than the phone/car-HU width above.
const TABLET_CARD_WIDTH = 380;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // left is supplied dynamically — see `positionStyle` in the component
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
  iconWrapTablet: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    ...TEXT_SHADOW,
  },
  titleTablet: {
    fontSize: 14,
  },
  distance: {
    fontSize: 10,
    fontWeight: '700',
    ...TEXT_SHADOW,
  },
  distanceTablet: {
    fontSize: 12,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    ...TEXT_SHADOW,
  },
  descriptionTablet: {
    fontSize: 15,
    lineHeight: 21,
  },
});

export default TimToast;
