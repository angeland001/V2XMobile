import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { ROUTE_COLORS, ROUTE_FONTS } from '../../UI/appTheme';

// 5.9 GHz is the real DSRC band this app's V2X broadcasts (TIM, SPaT,
// preemption) travel on — not a made-up label. The dot pulses to read as
// "actively receiving," not a static status chip.
export const LiveBroadcastBadge: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.container} accessibilityLabel="V2X broadcast reception active" accessible>
      <Animated.View style={[styles.dot, { opacity }]} />
      <Text style={styles.label}>V2X · 5.9GHz</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: ROUTE_COLORS.hairline,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ROUTE_COLORS.signal,
  },
  label: {
    fontFamily: ROUTE_FONTS.monoMedium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: ROUTE_COLORS.steel,
  },
});

export default LiveBroadcastBadge;
