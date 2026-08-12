import React from 'react';
import { View, Text } from 'react-native';
import { ROUTE_COLORS, ROUTE_FONTS } from '../appTheme';

// Shared by RoutePreviewSheet and AlertsScreen — both show the same 1-5 TIM
// severity risk indicator and previously each defined identical copies.
export function SeverityDots({ value }: { value: number }): React.ReactElement {
  const total = 5;
  const filled = Math.min(value, total);
  const color = value >= 4 ? ROUTE_COLORS.danger : value >= 3 ? ROUTE_COLORS.amberText : ROUTE_COLORS.signal;
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Text style={{ fontFamily: ROUTE_FONTS.mono, fontSize: 9, color: ROUTE_COLORS.steel, marginRight: 2 }}>RISK</Text>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: i < filled ? color : ROUTE_COLORS.hairline,
          }}
        />
      ))}
      <Text style={{ fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 10, color, marginLeft: 2 }}>{value}/5</Text>
    </View>
  );
}

export default SeverityDots;
