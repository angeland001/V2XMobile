// app/src/features/UI/components/icons/MarkerPin.tsx
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface MarkerPinProps {
  size?: number;
  color: string;
  iconSize?: number;
  children?: React.ReactNode;
}

// Map-pin silhouette: round head tapering to a point at the bottom tip.
const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';
const HEAD_CENTER_Y = 9 / 24; // fraction of size, matches the path's circular head

// Fraction of size where the pin's tip sits — use as the MapboxGL MarkerView anchor.y
export const MARKER_PIN_TIP_ANCHOR = 22 / 24;

export const MarkerPin: React.FC<MarkerPinProps> = ({ size = 32, color, iconSize, children }) => {
  const resolvedIconSize = iconSize ?? size * 0.4;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={PIN_PATH} fill={color} stroke="#FFFFFF" strokeWidth={1} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: size * HEAD_CENTER_Y - resolvedIconSize / 2,
          left: size / 2 - resolvedIconSize / 2,
        }}
      >
        {children}
      </View>
    </View>
  );
};

export default MarkerPin;
