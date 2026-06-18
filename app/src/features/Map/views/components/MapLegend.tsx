// app/src/features/Map/views/components/MapLegend.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const MapLegend: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.legendItem}>
        <View style={styles.vehicleIcon}>
          <View style={styles.vehicleIconInner} />
        </View>
        <Text style={styles.legendText}>Vehicle</Text>
      </View>

      <View style={styles.legendItem}>
        <View style={styles.pedestrianIcon}>
          <View style={styles.pedestrianIconInner} />
        </View>
        <Text style={styles.legendText}>Pedestrian</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 1000,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  legendText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '400',
    marginLeft: 6,
  },
  vehicleIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#3B82F6',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleIconInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  pedestrianIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6B35',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pedestrianIconInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
});

export default MapLegend;




