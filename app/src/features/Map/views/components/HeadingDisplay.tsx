// app/src/features/Map/views/components/HeadingDisplay.tsx

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { HeadingService, HeadingData } from '../../services/HeadingService';

interface HeadingDisplayProps {
  showDebug?: boolean;
}

export const HeadingDisplay: React.FC<HeadingDisplayProps> = ({
  showDebug = true,
}) => {
  const [headingData, setHeadingData] = useState<HeadingData>({
    heading: 0,
    accuracy: 0,
    timestamp: Date.now(),
    source: 'compass',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        await HeadingService.startTracking();
        unsubscribe = HeadingService.subscribe((data: HeadingData) => {
          setHeadingData(data);
          setIsUpdating(true);
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
          ]).start();
          if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = setTimeout(() => setIsUpdating(false), 300);
        });
      } catch (err) {
        console.error('Failed to start heading tracking:', err);
      }
    };

    init();
    return () => {
      if (unsubscribe) unsubscribe();
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });

  const getSourceColor = () => '#f59e0b'; // Orange - Native compass

  const cardinal = HeadingService.getCardinalDirection(headingData.heading);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>HEADING</Text>
        <Animated.View
          style={[
            styles.updateIndicator,
            { backgroundColor: isUpdating ? '#22c55e' : '#9ca3af', transform: [{ scale: pulseScale }] },
          ]}
        />
      </View>

      <View style={styles.headingRow}>
        <Text style={styles.heading}>{headingData.heading}°</Text>
        <Text style={styles.cardinal}>{cardinal}</Text>
      </View>

      <View style={styles.sourceRow}>
        <View style={[styles.sourceDot, { backgroundColor: getSourceColor() }]} />
        <Text style={[styles.sourceText, { color: getSourceColor() }]}>COMPASS</Text>
        <Text style={styles.accuracyText}>Acc: {headingData.accuracy}</Text>
      </View>

      {showDebug && (
        <View style={styles.debugRow}>
          <Text style={styles.debugBadge}>{HeadingService.getCardinalDirection(headingData.heading)}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
    minWidth: 110,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { fontSize: 9, fontWeight: '600', color: '#6b7280' },
  updateIndicator: { width: 6, height: 6, borderRadius: 3 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  cardinal: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginLeft: 4 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  sourceDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  sourceText: { fontSize: 8, fontWeight: '700' },
  accuracyText: { fontSize: 7, color: '#9ca3af', marginLeft: 4 },
  debugRow: { marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', alignItems: 'center' },
  debugBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

export default HeadingDisplay;
