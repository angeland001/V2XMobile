// app/src/features/Map/views/components/MapLegend.tsx
import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, useColorScheme } from 'react-native';
import { CarIcon } from '../../../UI/components/icons/CarIcon';
import { PedestrianIcon } from '../../../UI/components/icons/PedestrianIcon';
import { EntityBadge } from '../../../UI/components/icons/EntityBadge';
import { useResponsiveLayout } from '../../../UI/hooks/useResponsiveLayout';
import COLORS from '../../../UI/theme';

interface MapLegendProps {
  top: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

// Same light/dark chrome used by TimToast — kept in sync so overlays on the
// map read as one system rather than each picking its own dark/light call.
const THEME = {
  light: { bg: '#FFFFFF', border: '#E5E7EB', text: '#1A1A2E' },
  dark:  { bg: '#1E2030',  border: '#3A3D52', text: '#F5F6FA' },
} as const;

export const MapLegend: React.FC<MapLegendProps> = ({ top, onLayout }) => {
  const { isTablet } = useResponsiveLayout();
  const badgeScale = isTablet ? 1.4 : 1;
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? THEME.dark : THEME.light;

  return (
    <View
      style={[
        styles.container,
        isTablet && styles.containerTablet,
        { top, backgroundColor: theme.bg, borderColor: theme.border },
      ]}
      onLayout={onLayout}
    >
      <View style={styles.legendItem}>
        <EntityBadge size={16 * badgeScale} iconSize={9 * badgeScale} color={COLORS.orange}>
          <CarIcon size={9 * badgeScale} color={COLORS.white} />
        </EntityBadge>
        <Text style={[styles.legendText, isTablet && styles.legendTextTablet, { color: theme.text }]}>Vehicle</Text>
      </View>

      <View style={styles.legendItem}>
        <EntityBadge size={14 * badgeScale} iconSize={8 * badgeScale} color={COLORS.blue}>
          <PedestrianIcon size={8 * badgeScale} color={COLORS.white} />
        </EntityBadge>
        <Text style={[styles.legendText, isTablet && styles.legendTextTablet, { color: theme.text }]}>Pedestrian</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: '#FF8C00',
    zIndex: 1000,
  },
  containerTablet: {
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 6,
  },
  legendTextTablet: {
    fontSize: 14,
    marginLeft: 10,
  },
});

export default MapLegend;




