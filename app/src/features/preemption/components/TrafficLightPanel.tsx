import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import type { SsmStatus } from '../models/PreemptionModels';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';

export type TrafficLightState = 'red' | 'yellow' | 'green' | null;

interface TrafficLightPanelProps {
  activeLight?: TrafficLightState;
  intersectionName?: string;
  heartbeatPulse?: number; // 0–1, preemption heartbeat cycle (connection health, not phase timing)
  durationLabel?: string;
  ssmStatus?: SsmStatus;
  navOffset?: number;
  // True when inside an active zone but no live SPaT data has been matched for
  // its intersection — shown explicitly instead of silently displaying no light.
  spatUnavailable?: boolean;
  // When set, positions the panel from the top instead of its normal
  // bottom-anchored spot — used on wide/short car displays where it needs to
  // stack directly below the Auto Preemption toggle instead.
  top?: number;
  // Left inset; defaults to the panel's normal phone-layout position. Pass the
  // toggle's own left inset when stacking below it so both line up.
  left?: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

const LIGHTS: {
  key: TrafficLightState;
  activeColor: string;
  glowColor: string;
  dimColor: string;
}[] = [
  {
    key: 'red',
    activeColor: '#FF3B30',
    glowColor: 'rgba(255, 59, 48, 0.28)',
    dimColor: 'rgba(120, 20, 15, 0.5)',
  },
  {
    key: 'yellow',
    activeColor: '#FFD60A',
    glowColor: 'rgba(255, 214, 10, 0.28)',
    dimColor: 'rgba(120, 100, 5, 0.5)',
  },
  {
    key: 'green',
    activeColor: '#30D158',
    glowColor: 'rgba(48, 209, 88, 0.28)',
    dimColor: 'rgba(15, 90, 35, 0.5)',
  },
];

const STATUS_CONFIG: Record<
  Exclude<SsmStatus, null>,
  { label: string; color: string; borderColor: string }
> = {
  requesting: { label: 'REQUESTING...', color: '#FFD60A', borderColor: '#333' },
  granted:    { label: 'SIGNAL GRANTED', color: '#30D158', borderColor: '#333' },
  cancelled:  { label: 'SIGNAL LOST',   color: '#FF3B30', borderColor: '#FF3B30' },
};

// Housing scales up on tablet — the socket/light/bolt sizes below are all
// derived from this one factor rather than a second hardcoded style tier,
// since every dimension in the skeuomorphic housing needs to move together
// to still read as one physical object.
const TABLET_SCALE = 1.35;

export const TrafficLightPanel: React.FC<TrafficLightPanelProps> = ({
  activeLight = null,
  intersectionName,
  heartbeatPulse = 0,
  durationLabel = '--',
  ssmStatus = null,
  navOffset = 0,
  spatUnavailable = false,
  top,
  left = 16,
  onLayout,
}) => {
  const { isTablet } = useResponsiveLayout();
  const scale = isTablet ? TABLET_SCALE : 1;

  const progressAnim = useRef(new Animated.Value(heartbeatPulse)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // One-shot "preemption started" flash — a bright ring that fades out over
  // ~1.8s the moment ssmStatus first transitions to 'granted'. Deliberately
  // scoped to the existing panel rather than a new banner/modal: a driving UI
  // shouldn't grab more attention than a peripheral highlight on something the
  // driver's eyes are already tracking.
  const grantedFlashAnim = useRef(new Animated.Value(0)).current;
  const prevSsmStatusRef = useRef<SsmStatus>(ssmStatus);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: heartbeatPulse,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [heartbeatPulse]);

  useEffect(() => {
    if (ssmStatus === 'requesting') {
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
  }, [ssmStatus]);

  useEffect(() => {
    if (prevSsmStatusRef.current !== 'granted' && ssmStatus === 'granted') {
      grantedFlashAnim.setValue(1);
      Animated.timing(grantedFlashAnim, {
        toValue: 0,
        duration: 1800,
        useNativeDriver: false,
      }).start();
    }
    prevSsmStatusRef.current = ssmStatus;
  }, [ssmStatus]);

  const statusConfig = ssmStatus ? STATUS_CONFIG[ssmStatus] : null;
  const housingBorderColor = statusConfig?.borderColor ?? '#333';

  const lightSocketSize = 40 * scale;
  const lightSize = 32 * scale;
  const boltSize = 6 * scale;

  return (
    <View
      style={[
        styles.wrapper,
        { width: 76 * scale, left },
        top !== undefined ? { top } : { bottom: 100 + navOffset },
      ]}
      onLayout={onLayout}
    >
      {intersectionName ? (
        <View style={[styles.nameBadge, isTablet && styles.nameBadgeTablet]}>
          <Text style={[styles.nameText, isTablet && styles.nameTextTablet]} numberOfLines={2}>
            {intersectionName}
          </Text>
          {statusConfig && (
            <Animated.Text
              style={[
                styles.statusLabel,
                isTablet && styles.statusLabelTablet,
                { color: statusConfig.color },
                ssmStatus === 'requesting' && { opacity: pulseAnim },
              ]}
            >
              {statusConfig.label}
            </Animated.Text>
          )}
        </View>
      ) : null}

      <View style={styles.housingContainer}>
        <Animated.View
          pointerEvents="none"
          style={[styles.grantedFlashRing, { opacity: grantedFlashAnim }]}
        />
        <View style={[styles.housing, isTablet && styles.housingTablet, { borderColor: housingBorderColor }]}>
          <View style={[styles.bolt, { width: boltSize, height: boltSize, borderRadius: boltSize / 2 }]} />

          {LIGHTS.map(({ key, activeColor, glowColor, dimColor }) => {
            const isActive = activeLight === key;
            return (
              <View
                key={key}
                style={[
                  styles.lightSocket,
                  { width: lightSocketSize, height: lightSocketSize, borderRadius: lightSocketSize / 2 },
                  isActive && { backgroundColor: glowColor },
                ]}
              >
                <View
                  style={[
                    styles.light,
                    { width: lightSize, height: lightSize, borderRadius: lightSize / 2 },
                    { backgroundColor: isActive ? activeColor : dimColor },
                    isActive && {
                      shadowColor: activeColor,
                      shadowOpacity: 0.95,
                      // Kept small enough that the glow's falloff stays inside
                      // lightSocket's 4px margin around the light — the socket
                      // now clips overflow, so a larger radius here would just
                      // get chopped off at a hard edge instead of fading out.
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 6,
                    },
                  ]}
                />
              </View>
            );
          })}

          <View style={[styles.bolt, { width: boltSize, height: boltSize, borderRadius: boltSize / 2 }]} />

          {ssmStatus !== null && (
            <View style={[styles.progressTrack, isTablet && styles.progressTrackTablet]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}
          {spatUnavailable ? (
            <Text style={[styles.unavailableText, isTablet && styles.unavailableTextTablet]} numberOfLines={2}>
              SPaT unavailable
            </Text>
          ) : (
            <Text style={[styles.durationText, isTablet && styles.durationTextTablet]}>{durationLabel}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1000,
  },

  nameBadge: {
    backgroundColor: 'rgba(20, 20, 30, 0.82)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    alignItems: 'center',
    width: '100%',
  },
  nameBadgeTablet: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  nameText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  nameTextTablet: {
    fontSize: 12,
    lineHeight: 16,
  },
  statusLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  statusLabelTablet: {
    fontSize: 9,
  },

  housingContainer: {
    width: '100%',
    position: 'relative',
  },
  grantedFlashRing: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#30D158',
  },
  housing: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  housingTablet: {
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  bolt: {
    backgroundColor: '#444',
    marginVertical: 2,
  },
  lightSocket: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    overflow: 'hidden',
  },
  light: {},

  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressTrackTablet: {
    height: 7,
    marginTop: 13,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1a73e8',
    borderRadius: 3,
  },
  durationText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    fontWeight: '500',
    marginTop: 5,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  durationTextTablet: {
    fontSize: 11,
  },
  unavailableText: {
    color: '#f59e0b',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  unavailableTextTablet: {
    fontSize: 11,
  },
});

export default TrafficLightPanel;
