// app/src/features/Map/views/components/MapLegend.tsx
import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { CarIcon } from '../../../UI/components/icons/CarIcon';
import { PedestrianIcon } from '../../../UI/components/icons/PedestrianIcon';

interface MapLegendProps {
  top: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({ top, onLayout }) => {
  return (
    <View style={[styles.container, { top }]} onLayout={onLayout}>
      <View style={styles.legendItem}>
        <View style={styles.vehicleIcon}>
          <CarIcon size={12} color="#0082BF" />
        </View>
        <Text style={styles.legendText}>Vehicle</Text>
      </View>

      <View style={styles.legendItem}>
        <View style={styles.pedestrianIcon}>
          <PedestrianIcon size={11} color="#0082BF" />
        </View>
        <Text style={styles.legendText}>Pedestrian</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(18, 18, 28, 0.92)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#FF8C00',
    zIndex: 1000,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#E2E8F0',
    fontWeight: '500',
    marginLeft: 6,
  },
  vehicleIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pedestrianIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MapLegend;




