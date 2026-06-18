import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimService } from '../../TIM/services/TimService';
// Toast stays dark regardless of theme — it's an overlay that needs to read on any background
const TOAST_COLORS = {
  bg: 'rgba(20, 20, 30, 0.96)',
  red: '#EF4444',
  redBg: 'rgba(239, 68, 68, 0.15)',
  amber: '#F59E0B',
  amberBg: 'rgba(245, 158, 11, 0.15)',
  text: '#F1F5F9',
};

interface TimToastProps {
  timService: TimService;
}

export const TimToast: React.FC<TimToastProps> = observer(({ timService }) => {
  const toast = timService.toastQueue[0] ?? null;
  const insets = useSafeAreaInsets();

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const showingId = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const isSafety = toast.category === 'safety';
  const accentColor = isSafety ? TOAST_COLORS.red : TOAST_COLORS.amber;
  const iconBg     = isSafety ? TOAST_COLORS.redBg : TOAST_COLORS.amberBg;
  const icon       = isSafety ? '⚠️' : '🚧';

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
        <Text style={[styles.label, { color: accentColor }]}>
          {isSafety ? 'SAFETY ALERT' : 'ZONE WARNING'}
        </Text>
        <Text style={styles.message} numberOfLines={2}>{toast.message}</Text>
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
    gap: 1,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  message: {
    color: TOAST_COLORS.text,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});

export default TimToast;
