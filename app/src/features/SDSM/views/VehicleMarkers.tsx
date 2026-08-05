// app/src/features/SDSM/views/VehicleMarkers.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VehicleDisplayViewModel } from '../viewmodels/VehicleDisplayViewModel';
import { isValidLngLat } from '../../../core/maps/coordinates';
import { CarIcon } from '../../UI/components/icons/CarIcon';

interface VehicleMarkersProps {
  viewModel: VehicleDisplayViewModel;
}

export const VehicleMarkers: React.FC<VehicleMarkersProps> = observer(({ viewModel }) => {
  if (!viewModel?.isActive || viewModel.vehicles.length === 0) return null;

  const vehicles = viewModel.vehicles.filter((vehicle) => {
    const coords = viewModel.getMapCoordinates(vehicle);
    return isValidLngLat(coords) && coords[0] !== 0 && coords[1] !== 0;
  });

  return (
    <>
      {vehicles.map((vehicle) => (
        <MapboxGL.MarkerView
          key={String(vehicle.id)}
          coordinate={viewModel.getMapCoordinates(vehicle)}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.marker}>
            <CarIcon size={14} color="#0082BF" />
          </View>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default VehicleMarkers;
