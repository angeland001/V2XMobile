// app/src/features/UI/components/icons/EntityBadge.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface EntityBadgeProps {
  size?: number;
  color: string;
  iconSize?: number;
  children?: React.ReactNode;
}

const RING_WIDTH = 1.5;

// Sensed-entity mark: a flush circular badge, not a pin. Reserved for live
// SDSM road users (vehicles/pedestrians) so they read as tracked objects
// rather than dropped-pin places — see MarkerPin for the latter.
export const EntityBadge: React.FC<EntityBadgeProps> = ({
  size = 30,
  color,
  iconSize,
  children,
}) => {
  const resolvedIconSize = iconSize ?? size * 0.55;
  const radius = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={radius}
          cy={radius}
          r={radius - RING_WIDTH / 2}
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={RING_WIDTH}
        />
      </Svg>

      <View
        style={[
          styles.centered,
          {
            width: resolvedIconSize,
            height: resolvedIconSize,
            top: radius - resolvedIconSize / 2,
            left: radius - resolvedIconSize / 2,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EntityBadge;
