import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export type TrafficLightState = 'red' | 'yellow' | 'green' | null;

interface TrafficLightPanelProps {
  activeLight?: TrafficLightState;
  intersectionName?: string;
  progress?: number; // 0–1
  durationLabel?: string;
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

export const TrafficLightPanel: React.FC<TrafficLightPanelProps> = ({
  activeLight = 'red',
  intersectionName = 'Intersection 12 · US-27',
  progress = 0.45,
  durationLabel = '18s / 40s',
}) => {
  const progressAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.wrapper}>
      {/* Intersection name badge */}
      <View style={styles.nameBadge}>
        <Text style={styles.nameText} numberOfLines={2}>
          {intersectionName}
        </Text>
        <Text style={styles.preemptedLabel}>PREEMPTED</Text>
      </View>

      {/* Traffic light housing */}
      <View style={styles.housing}>
        {/* Top bolt */}
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

        {/* Bottom bolt */}
        <View style={styles.bolt} />

        {/* Progress bar + label — inside the housing so they're always on dark bg */}
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
        <Text style={styles.durationText}>{durationLabel}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 76,
  },

  // Intersection name
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
  preemptedLabel: {
    color: '#FF8C00',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  // Housing
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

  // Progress bar
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
    backgroundColor: '#FF8C00',
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
});
