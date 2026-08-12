import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { ROUTE_COLORS } from '../../UI/appTheme';

interface TransmissionPulseProps {
  height: number;
  color?: string;
}

// The signature motif of the Route redesign: origin and destination aren't
// joined by a static dotted line — a small pulse travels the track between
// them on a loop, asserting (literally, not decoratively) that this route
// is being monitored against live V2X broadcasts the whole way, which is
// the one thing this screen is actually for. Built on core RN Animated
// rather than Reanimated worklets — this repo has no babel.config.js
// registering the Reanimated plugin (see TimToast.tsx / RoutePreviewSheet.tsx).
export const TransmissionPulse: React.FC<TransmissionPulseProps> = ({ height, color = ROUTE_COLORS.amber }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const travel = Math.max(height - 6, 0);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <View style={[styles.track, { height }]}>
      <Animated.View style={[styles.pulse, { backgroundColor: color, transform: [{ translateY }], opacity }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 1.5,
    backgroundColor: ROUTE_COLORS.hairline,
    alignItems: 'center',
    overflow: 'hidden',
  },
  pulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginLeft: -1.75,
  },
});

export default TransmissionPulse;
