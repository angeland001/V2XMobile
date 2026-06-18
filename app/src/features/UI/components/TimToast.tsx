import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimService } from '../../TIM/services/TimService';
import { SettingsViewModel } from '../viewmodels/SettingsViewModel';

// Toast stays dark regardless of theme — it's an overlay that needs to read on any background
const TOAST_COLORS = {
  bg: 'rgba(20, 20, 30, 0.96)',
  red: '#EF4444',
  redBg: 'rgba(239, 68, 68, 0.15)',
  amber: '#F59E0B',
  amberBg: 'rgba(245, 158, 11, 0.15)',
  blue: '#38BDF8',
  blueBg: 'rgba(56, 189, 248, 0.15)',
  text: '#F1F5F9',
  meta: 'rgba(241, 245, 249, 0.5)',
};

function severityInfo(severity: number): { label: string; color: string } {
  if (severity >= 7) return { label: 'CRITICAL', color: '#EF4444' };
  if (severity >= 5) return { label: 'HIGH',     color: '#F97316' };
  if (severity >= 3) return { label: 'MODERATE', color: '#F59E0B' };
  if (severity >= 1) return { label: 'LOW',      color: '#22C55E' };
  return { label: 'UNKNOWN', color: 'rgba(241,245,249,0.4)' };
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

interface TimToastProps {
  timService: TimService;
  settingsViewModel: SettingsViewModel;
}

export const TimToast: React.FC<TimToastProps> = observer(({ timService, settingsViewModel }) => {
  const toast = timService.toastQueue[0] ?? null;
  const insets = useSafeAreaInsets();

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const showingId = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss toasts whose category is disabled in settings
  useEffect(() => {
    if (!toast) return;
    const enabled =
      (toast.category === 'safety' && settingsViewModel.safetyAlerts) ||
      (toast.category === 'regulatory' && settingsViewModel.regulatoryAlerts) ||
      (toast.category === 'informational' && settingsViewModel.informationalAlerts);
    if (!enabled) timService.dismissToast(toast.id);
  }, [toast?.id, settingsViewModel.safetyAlerts, settingsViewModel.regulatoryAlerts, settingsViewModel.informationalAlerts]);

  useEffect(() => {
    if (!toast) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      showingId.current = null;
      return;
    }

    if (toast.id === showingId.current) return;
    showingId.current = toast.id;

    if (timerRef.current) clearTimeout(timerRef.current);

    opacity.setValue(0);
    translateY.setValue(-20);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 320, useNativeDriver: true }),
      ]).start(() => {
        timService.dismissToast(toast.id);
      });
    }, 4000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast?.id]);

  if (!toast) return null;

  const accentColor =
    toast.category === 'safety' ? TOAST_COLORS.red :
    toast.category === 'regulatory' ? TOAST_COLORS.amber :
    TOAST_COLORS.blue;
  const iconBg =
    toast.category === 'safety' ? TOAST_COLORS.redBg :
    toast.category === 'regulatory' ? TOAST_COLORS.amberBg :
    TOAST_COLORS.blueBg;
  const icon =
    toast.category === 'safety' ? '⚠️' :
    toast.category === 'regulatory' ? '🚧' : 'ℹ️';
  const categoryLabel =
    toast.category === 'safety' ? 'SAFETY ALERT' :
    toast.category === 'regulatory' ? 'ZONE WARNING' : 'ROAD INFO';

  const distanceMi = timService.timDistances.get(toast.timId);
  const sev = severityInfo(toast.severity);

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 10, opacity, transform: [{ translateY }], borderLeftColor: accentColor },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.textWrap}>
        <View style={styles.topRow}>
          <Text style={[styles.label, { color: accentColor }]}>{categoryLabel}</Text>
          <View style={[styles.sevBadge, { borderColor: sev.color }]}>
            <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
          </View>
        </View>
        <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
        {distanceMi != null && (
          <Text style={styles.metaText}>📍 {formatDistance(distanceMi)} away</Text>
        )}
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOAST_COLORS.bg,
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingVertical: 10,
    paddingRight: 14,
    paddingLeft: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 16,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  sevBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  sevText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  message: {
    color: TOAST_COLORS.text,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  metaText: {
    color: TOAST_COLORS.meta,
    fontSize: 10,
    fontWeight: '500',
  },
});

export default TimToast;
