// app/src/features/DirectionGuide/views/components/CombinedTurnIcon.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface CombinedTurnIconProps {
  allowLeft: boolean;
  allowStraight: boolean;
  size?: number;
}

export const CombinedTurnIcon: React.FC<CombinedTurnIconProps> = ({
  allowLeft,
  allowStraight,
  size = 50,
}) => {
  const leftColor = allowLeft ? '#22c55e' : '#ef4444';
  const straightColor = allowStraight ? '#22c55e' : '#ef4444';

  // Arrowhead helper: given tip (tx, ty) and angle (deg), returns triangle path
  const triangle = (tx: number, ty: number, angleDeg: number, scale = 1) => {
    // triangle points relative to tip pointing left (−x): tip, back-top, back-bottom
    const w = 6 * scale; // length
    const h = 4 * scale; // half height
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

  // Straight arrow: line from (25,40) to (25,12), head points up (−90° from +x is 270°, or −90)
  const straightHead = triangle(25, 5, -270, 1.3);


  // Left curve: simple quad curve to (10,25), approximate head pointing left (180°)
  const leftHead = triangle(2, 25, -360, 1.3);


  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 50 50">
        {/* Straight shaft */}
        <Path
          d="M25 40 L25 12"
          stroke={straightColor}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        {/* Straight head */}
        <Path d={straightHead} fill={straightColor} />

        {/* Left curved shaft */}
        <Path
          d="M25 40 Q25 25 10 25"
          stroke={leftColor}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        {/* Left head */}
        <Path d={leftHead} fill={leftColor} />

        {/* Start dot */}
        <Circle cx={25} cy={40} r={3} fill="#666" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
});

export default CombinedTurnIcon;
