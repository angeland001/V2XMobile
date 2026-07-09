import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { SsmStatus } from '../models/PreemptionModels';

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
  granted:    { label: 'SIGNAL GRANTED', color: '#30D158', borderColor: '#30D158' },
  cancelled:  { label: 'SIGNAL LOST',   color: '#FF3B30', borderColor: '#FF3B30' },
};

export const TrafficLightPanel: React.FC<TrafficLightPanelProps> = ({
  activeLight = null,
  intersectionName,
  heartbeatPulse = 0,
  durationLabel = '--',
  ssmStatus = null,
  navOffset = 0,
  spatUnavailable = false,
}) => {
  const progressAnim = useRef(new Animated.Value(heartbeatPulse)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

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

  const statusConfig = ssmStatus ? STATUS_CONFIG[ssmStatus] : null;
  const housingBorderColor = statusConfig?.borderColor ?? '#333';

  return (
    <View style={[styles.wrapper, { bottom: 100 + navOffset }]}>
      {intersectionName ? (
        <View style={styles.nameBadge}>
          <Text style={styles.nameText} numberOfLines={2}>
            {intersectionName}
          </Text>
          {statusConfig && (
            <Animated.Text
              style={[
                styles.statusLabel,
                { color: statusConfig.color },
                ssmStatus === 'requesting' && { opacity: pulseAnim },
              ]}
            >
              {statusConfig.label}
            </Animated.Text>
          )}
        </View>
      ) : null}

      <View style={[styles.housing, { borderColor: housingBorderColor }]}>
        <View style={styles.bolt} />

        {LIGHTS.map(({ key, activeColor, glowColor, dimColor }) => {
          const isActive = activeLight === key;
          return (
            <View
              key={key}
              style={[styles.lightSocket, isActive && { backgroundColor: glowColor }]}
            >
              <View
                style={[
                  styles.light,
                  { backgroundColor: isActive ? activeColor : dimColor },
                  isActive && {
                    shadowColor: activeColor,
                    shadowOpacity: 0.95,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 14,
                  },
                ]}
              />
            </View>
          );
        })}

        <View style={styles.bolt} />

        {ssmStatus !== null && (
          <View style={styles.progressTrack}>
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
          <Text style={styles.unavailableText} numberOfLines={2}>
            SPaT unavailable
          </Text>
        ) : (
          <Text style={styles.durationText}>{durationLabel}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    alignItems: 'center',
    width: 76,
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
  nameText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },
  statusLabel: {
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
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
  bolt: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
    marginVertical: 2,
  },
  lightSocket: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
  },
  light: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  progressTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
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
  unavailableText: {
    color: '#f59e0b',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
});

export default TrafficLightPanel;
