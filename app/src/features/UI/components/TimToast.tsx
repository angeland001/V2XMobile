import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimService } from '../../TIM/services/TimService';
import { RouteViewModel } from '../../Route/viewmodels/RouteViewModel';
import { SettingsViewModel } from '../viewmodels/SettingsViewModel';

// Stays dark regardless of theme — it's an overlay that needs to read on any background
const COLORS = {
  bg: 'rgba(20, 20, 30, 0.9)',
  red: '#EF4444',
  amber: '#F59E0B',
  blue: '#38BDF8',
  text: '#F1F5F9',
  meta: 'rgba(241, 245, 249, 0.55)',
};

type TimCategory = 'safety' | 'regulatory' | 'informational';

interface DisplayItem {
  key: string;
  category: TimCategory;
  message: string;
  distanceM: number | null;
  persistent: boolean; // true = stays until condition clears; false = auto-dismiss
}

function accentFor(category: TimCategory): string {
  return category === 'safety' ? COLORS.red : category === 'regulatory' ? COLORS.amber : COLORS.blue;
}

function iconFor(category: TimCategory): string {
  return category === 'safety' ? '⚠️' : category === 'regulatory' ? '🚧' : 'ℹ️';
}

function formatDistanceMeters(m: number): string {
  const ft = m * 3.28084;
  if (ft < 1000) return `${Math.round(ft / 50) * 50 || Math.round(ft)} ft`;
  const mi = m / 1609.34;
  return `${mi.toFixed(1)} mi`;
}

interface TimZoneChipProps {
  item: DisplayItem;
  onAutoDismiss?: () => void;
}

const TimZoneChip: React.FC<TimZoneChipProps> = ({ item, onAutoDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(24)).current;

  // Keyed on item.key by the parent list, so this effect only re-fires the
  // entrance animation when a genuinely new zone appears, not on every tick.
  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 140, friction: 12 }),
    ]).start();

    if (!item.persistent && onAutoDismiss) {
      const timer = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onAutoDismiss);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [item.key]);

  const accent = accentFor(item.category);

  return (
    <Animated.View style={[styles.chip, { borderLeftColor: accent, opacity, transform: [{ translateX }] }]}>
      <Text style={styles.icon}>{iconFor(item.category)}</Text>
      <View style={styles.chipText}>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        {item.distanceM != null && (
          <Text style={styles.meta}>{formatDistanceMeters(item.distanceM)} ahead</Text>
        )}
      </View>
    </Animated.View>
  );
};

interface TimToastProps {
  timService: TimService;
  routeViewModel: RouteViewModel;
  settingsViewModel: SettingsViewModel;
  isNavigating?: boolean;
}

// Height of NavigationBanner (status bar + content)
const NAV_BANNER_HEIGHT = 130;
const MAX_VISIBLE = 2;

export const TimToast: React.FC<TimToastProps> = observer(
  ({ timService, routeViewModel, settingsViewModel, isNavigating = false }) => {
    const insets = useSafeAreaInsets();

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

    let items: DisplayItem[];
    if (isNavigating) {
      // Persistent: stays until the route no longer crosses the zone or the user enters it.
      items = routeViewModel.approachingTimZones
        .filter((hit) => categoryEnabled(hit.category))
        .sort((a, b) => (routeViewModel.approachingTimZoneDistancesM.get(a.timId) ?? Infinity) -
                        (routeViewModel.approachingTimZoneDistancesM.get(b.timId) ?? Infinity))
        .slice(0, MAX_VISIBLE)
        .map((hit) => ({
          key: `route-${hit.timId}`,
          category: hit.category,
          message: hit.description ?? `${hit.timType} ahead`,
          distanceM: routeViewModel.approachingTimZoneDistancesM.get(hit.timId) ?? null,
          persistent: true,
        }));
    } else if (ambientToast && categoryEnabled(ambientToast.category)) {
      const distanceMi = timService.timDistances.get(ambientToast.timId);
      items = [{
        key: ambientToast.id,
        category: ambientToast.category,
        message: ambientToast.message,
        distanceM: distanceMi != null ? distanceMi * 1609.34 : null,
        persistent: false,
      }];
    } else {
      items = [];
    }

    if (items.length === 0) return null;

    return (
      <View
        style={[
          styles.container,
          { top: isNavigating ? NAV_BANNER_HEIGHT + 10 : insets.top + 10 },
        ]}
        pointerEvents="none"
      >
        {items.map((item) => (
          <TimZoneChip
            key={item.key}
            item={item}
            onAutoDismiss={!item.persistent ? () => timService.dismissToast(item.key) : undefined}
          />
        ))}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 10,
    maxWidth: 180,
    gap: 8,
    zIndex: 9999,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 10,
  },
  icon: {
    fontSize: 13,
  },
  chipText: {
    flex: 1,
    gap: 2,
  },
  message: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  meta: {
    color: COLORS.meta,
    fontSize: 9,
    fontWeight: '500',
  },
});

export default TimToast;
