// app/src/features/DirectionGuide/views/components/TurnIcon.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

// Traffic signal states for turns
export enum TurnSignalState {
  ALLOWED = 'allowed',     // Green
  PROHIBITED = 'prohibited', // Red
  WARNING = 'warning',     // Yellow/Amber
}

// Turn icon configurations
export interface TurnIconConfig {
  leftTurn: TurnSignalState;
  straightTurn: TurnSignalState;
  rightTurn?: TurnSignalState;
  showLeft?: boolean;      // Control whether to render left arrow
  showStraight?: boolean;  // Control whether to render straight arrow
  showRight?: boolean;     // Control whether to render right arrow
  size?: number;
}

interface TurnIconProps extends TurnIconConfig {}

export const TurnIcon: React.FC<TurnIconProps> = ({
  leftTurn,
  straightTurn,
  rightTurn,
  showLeft = true,
  showStraight = true,
  showRight = true,
  size = 50,
}) => {
  // Get colors based on signal state
  const getStateColor = (state: TurnSignalState): string => {
    switch (state) {
      case TurnSignalState.ALLOWED:
        return '#22c55e'; // Green
      case TurnSignalState.PROHIBITED:
        return '#ef4444'; // Red
      case TurnSignalState.WARNING:
        return '#f59e0b'; // Amber/Yellow
      default:
        return '#6b7280'; // Gray fallback
    }
  };

  const leftColor = getStateColor(leftTurn);
  const straightColor = getStateColor(straightTurn);
  const rightColor = rightTurn ? getStateColor(rightTurn) : '#6b7280';

  // Arrowhead helper
  const triangle = (tx: number, ty: number, angleDeg: number, scale = 1) => {
    const w = 6 * scale;
    const h = 4 * scale;
    const pts = [
      [0, 0],
      [w, -h],
      [w, h],
    ];

    const rad = (Math.PI / 180) * angleDeg;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rot = pts.map(([x, y]) => [
      tx + x * cos - y * sin,
      ty + x * sin + y * cos,
    ]);

    return `M ${rot[0][0]},${rot[0][1]} L ${rot[1][0]},${rot[1][1]} L ${rot[2][0]},${rot[2][1]} Z`;
  };

  // Arrow heads
  const straightHead = triangle(25, 5, -270, 1.3);
  const leftHead = triangle(2, 25, -360, 1.3);
  const rightHead = triangle(48, 25, -180, 1.3);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 50 50">
        {/* Straight shaft - Only show if showStraight is true */}
        {showStraight && (
          <>
            <Path
              d="M25 40 L25 12"
              stroke={straightColor}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
            <Path d={straightHead} fill={straightColor} />
          </>
        )}

        {/* Left curved shaft - Only show if showLeft is true */}
        {showLeft && (
          <>
            <Path
              d="M25 40 Q25 25 10 25"
              stroke={leftColor}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
            <Path d={leftHead} fill={leftColor} />
          </>
        )}

        {/* Right curved shaft - Only show if showRight is true and rightTurn is provided */}
        {showRight && rightTurn && (
          <>
            <Path
              d="M25 40 Q25 25 40 25"
              stroke={rightColor}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
            />
            <Path d={rightHead} fill={rightColor} />
          </>
        )}

        {/* Start dot */}
        <Circle cx={25} cy={40} r={3} fill="#666" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  },
});

export default TurnIcon;