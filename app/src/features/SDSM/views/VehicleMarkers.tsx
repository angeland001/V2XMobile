// app/src/features/SDSM/views/VehicleMarkers.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VehicleDisplayViewModel } from '../viewmodels/VehicleDisplayViewModel';

interface VehicleMarkersProps {
  viewModel: VehicleDisplayViewModel;
}

export const VehicleMarkers: React.FC<VehicleMarkersProps> = observer(({ viewModel }) => {
  if (!viewModel?.isActive || viewModel.vehicles.length === 0) {
    return null;
  }

  return (
    <>
      {viewModel.vehicles.map((vehicle) => {
        const mapboxCoords = viewModel.getMapboxCoordinates(vehicle);

        // Safety check for coordinates
        if (!mapboxCoords || mapboxCoords.length !== 2 ||
            typeof mapboxCoords[0] !== 'number' ||
            typeof mapboxCoords[1] !== 'number' ||
            mapboxCoords[0] === 0 || mapboxCoords[1] === 0) {
          return null;
        }

        return (
          <MapboxGL.PointAnnotation
            key={`sdsm-vehicle-${vehicle.id}`}
            id={`sdsm-vehicle-${vehicle.id}`}
            coordinate={mapboxCoords}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.vehicleIcon}>
              <View style={styles.vehicleIconInner} />
            </View>
          </MapboxGL.PointAnnotation>
        );
      })}
    </>
  );
});

// Separate component to track individual vehicle overlay events
const VehicleMarkerItem: React.FC<{
  vehicleId: number;
  coordinates: [number, number];
}> = ({ vehicleId, coordinates }) => {
  return (
    <MapboxGL.MarkerView
      id={`sdsm-vehicle-${vehicleId}`}
      coordinate={coordinates}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <VehicleIcon />
    </MapboxGL.MarkerView>
  );
};

const styles = StyleSheet.create({
  vehicleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleIconInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});