import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { observer } from 'mobx-react-lite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimService } from '../../TIM/services/TimService';
import { RouteViewModel } from '../../Route/viewmodels/RouteViewModel';
import { SettingsViewModel } from '../viewmodels/SettingsViewModel';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { formatTimType } from '../utils/timFormatting';

type TimCategory = 'safety' | 'regulatory' | 'informational';

const CATEGORY_ORDER: TimCategory[] = ['safety', 'regulatory', 'informational'];

// The banner itself is neutral (always light, see NEUTRAL below) — category
// is signaled only through the icon and its tinted badge, not the whole
// card. Card colors below are the icon accent only.
const CATEGORY_STYLE: Record<TimCategory, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
}> = {
  safety:        { icon: 'warning',            label: 'Safety',      accent: '#DC2626' },
  regulatory:    { icon: 'ban',                 label: 'Regulatory',  accent: '#CA8A04' },
  informational: { icon: 'information-circle',  label: 'Info',        accent: '#2563EB' },
};

// Neutral banner chrome — background, border, and text all come from here so
// the card itself carries no category color. Always light: the rest of the
// Route/nav UI (RoutePreviewSheet, NavigationSummaryBar, etc.) never follows
// system dark mode either, so a dark card here read as inconsistent whenever
// the device/car display happened to be in dark mode.
const NEUTRAL = {
  bg: '#FFFFFF',
  border: '#E5E7EB',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  shadow: 'rgba(0,0,0,0.2)',
} as const;

interface DisplayItem {
  key: string;
  category: TimCategory;
  message: string;
  // Every card is persistent — shown for as long as the driver is physically
  // inside the zone it's for, and cleared the instant they leave it (see the
  // ambient/nav branches below) — plus a local per-key dismiss so a tap can
  // hide one without waiting for the driver to exit the zone.
  onDismiss: () => void;
}

interface TimAlertCardProps {
  item: DisplayItem;
  isTablet?: boolean;
}

// Card enters/exits from off the left edge of the screen (container is left-anchored).
const OFFSCREEN_X = -320;

const TimAlertCard: React.FC<TimAlertCardProps> = ({ item, isTablet = false }) => {
  const translateX = useSharedValue(OFFSCREEN_X);
  const opacity = useSharedValue(0);

  // Plain (non-worklet) conditional style, not a reanimated shared value —
  // the card's actual content sits in a plain View precisely so it renders
  // correctly even if reanimated worklets are misbehaving (this repo has no
  // babel.config.js registering the reanimated plugin). Only the outer
  // entrance/exit slide, which doesn't gate content visibility, uses reanimated.
  // Every card here is a zone the driver is currently inside of, so a safety
  // zone always gets the heavier treatment — there's no distance to qualify it by.
  const isUrgent = item.category === 'safety';

  // Keyed on item.key by the parent list, so this effect only re-fires the
  // entrance animation when a genuinely new zone appears, not on every tick.
  useEffect(() => {
    translateX.value = OFFSCREEN_X;
    opacity.value = 0;
    translateX.value = withSpring(0, { damping: 16, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  const cfg = CATEGORY_STYLE[item.category];

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={item.onDismiss}>
        <View style={[styles.alert, { backgroundColor: NEUTRAL.bg, borderColor: NEUTRAL.border, borderWidth: isUrgent ? 3 : 1 }]}>
          <View style={[styles.iconWrap, isTablet && styles.iconWrapTablet, { backgroundColor: `${cfg.accent}26` }]}>
            <Ionicons name={cfg.icon} size={isTablet ? 19 : 15} color={cfg.accent} />
          </View>
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, isTablet && styles.titleTablet, { color: NEUTRAL.text, textShadowColor: NEUTRAL.shadow }]}>
                {cfg.label.toUpperCase()}
              </Text>
              <Text style={[styles.distance, isTablet && styles.distanceTablet, { color: NEUTRAL.textSecondary, textShadowColor: NEUTRAL.shadow }]}>IN ZONE</Text>
            </View>
            <Text style={[styles.description, isTablet && styles.descriptionTablet, { color: NEUTRAL.text, textShadowColor: NEUTRAL.shadow }]} numberOfLines={2}>{item.message}</Text>
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

    const dismiss = (key: string): void => {
      setDismissedKeys((prev) => new Set(prev).add(key));
    };

    // Both branches are the same shape: a card is shown for exactly as long
    // as the driver is physically inside the zone it's for, and disappears
    // the instant they leave it — re-entering (even the same zone, later)
    // shows it again, since the underlying state (RouteViewModel.insideTimZones
    // / TimService.nearbyByCategory) is recomputed fresh every tick, not a
    // one-shot queue.
    let rawItems: DisplayItem[];
    if (isNavigating) {
      rawItems = routeViewModel.insideTimZones
        .filter((hit) => categoryEnabled(hit.category))
        .sort((a, b) => b.severity - a.severity)
        .slice(0, MAX_VISIBLE)
        .map((hit) => {
          const key = `route-${hit.timId}`;
          return {
            key,
            category: hit.category,
            // `||` also catches an empty string — the API can send one,
            // which would otherwise render as blank text.
            message: hit.description || formatTimType(hit.timType),
            onDismiss: () => dismiss(key),
          };
        });
    } else {
      rawItems = CATEGORY_ORDER
        .filter((category) => categoryEnabled(category) && timService.nearbyByCategory[category] != null)
        .map((category) => ({ category, nearby: timService.nearbyByCategory[category]! }))
        .sort((a, b) => b.nearby.severity - a.nearby.severity)
        .slice(0, MAX_VISIBLE)
        .map(({ category, nearby }) => {
          const key = `ambient-${nearby.timId}`;
          return {
            key,
            category,
            message: nearby.description || formatTimType(nearby.timType),
            onDismiss: () => dismiss(key),
          };
        });
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
          <TimAlertCard key={item.key} item={item} isTablet={isTablet} />
        ))}
      </View>
    );
  },
);

// textShadowColor is supplied per-item (see `NEUTRAL.shadow`) rather than
// folded into TEXT_SHADOW below, since these Text styles are built from
// several spread objects and this keeps the color grouped with the other
// NEUTRAL.* values above instead of split across two places.
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
