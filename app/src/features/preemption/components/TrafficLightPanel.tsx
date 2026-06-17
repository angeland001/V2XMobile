import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable } from 'react-native';

export type TrafficLightState = 'red' | 'yellow' | 'green' | null;

interface TrafficLightPanelProps {
  activeLight?: TrafficLightState;
  intersectionName?: string;
  progress?: number; // 0–1
  durationLabel?: string;
  autoEnabled?: boolean;
  onToggleAuto?: (enabled: boolean) => void;
  insideZone?: boolean;
  sessionActive?: boolean;
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
  autoEnabled = false,
  onToggleAuto,
  insideZone = false,
  sessionActive = false,
}) => {
  const progressAnim = useRef(new Animated.Value(progress)).current;
  const dotPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Pulse the dot when armed and inside a zone
  useEffect(() => {
    if (autoEnabled && insideZone) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(dotPulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
          Animated.timing(dotPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      dotPulse.setValue(1);
    }
  }, [autoEnabled, insideZone]);

  return (
    <View style={styles.wrapper}>
      {/* Auto arm/disarm chip — always visible */}
      <Pressable
        style={[styles.autoChip, autoEnabled ? styles.autoChipOn : styles.autoChipOff]}
        onPress={() => onToggleAuto?.(!autoEnabled)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.View
          style={[
            styles.autoDot,
            autoEnabled ? styles.autoDotOn : styles.autoDotOff,
            { opacity: dotPulse },
          ]}
        />
        <Text style={[styles.autoText, autoEnabled ? styles.autoTextOn : styles.autoTextOff]}>
          Auto
        </Text>
      </Pressable>

      {/* Expanded panel — only when inside a SPaT zone */}
      {insideZone && (
        <>
          {/* Intersection name badge */}
          <View style={styles.nameBadge}>
            <Text style={styles.nameText} numberOfLines={2}>
              {intersectionName}
            </Text>
            {sessionActive && (
              <Text style={styles.preemptedLabel}>PREEMPTED</Text>
            )}
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

            {/* Progress bar + label */}
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
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 76,
  },

  // Auto chip
  autoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 6,
  },
  autoChipOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  autoChipOff: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  autoDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  autoDotOn: {
    backgroundColor: '#10b981',
  },
  autoDotOff: {
    backgroundColor: '#6b7280',
  },
  autoText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  autoTextOn: {
    color: '#10b981',
  },
  autoTextOff: {
    color: 'rgba(255,255,255,0.6)',
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

export default TrafficLightPanel;
