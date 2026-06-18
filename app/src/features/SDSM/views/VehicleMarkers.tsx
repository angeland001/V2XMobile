// app/src/features/SDSM/views/VehicleMarkers.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { observer } from 'mobx-react-lite';
import { VehicleDisplayViewModel } from '../viewmodels/VehicleDisplayViewModel';
import { isValidLngLat, toGoogleLatLng } from '../../../core/maps/coordinates';

interface VehicleMarkersProps {
  viewModel: VehicleDisplayViewModel;
}

const CIRCLE_STYLE = {
  circleRadius: 10,
  circleColor: '#3B82F6',
  circleStrokeWidth: 3,
  circleStrokeColor: '#FFFFFF',
} as const;

export const VehicleMarkers: React.FC<VehicleMarkersProps> = observer(({ viewModel }) => {
  if (!viewModel?.isActive || viewModel.vehicles.length === 0) return null;

  const vehicles = viewModel.vehicles
    .map((vehicle) => {
      const coords = viewModel.getMapCoordinates(vehicle);
      if (!isValidLngLat(coords) || coords[0] === 0 || coords[1] === 0) return null;
      return { id: String(vehicle.id), coordinate: toGoogleLatLng(coords) };
    })
    .filter(Boolean);

  if (vehicles.length === 0) return null;

  return (
    <>
      {vehicles.map((vehicle) => vehicle && (
        <Marker
          key={`sdsm-vehicle-${vehicle.id}`}
          identifier={`sdsm-vehicle-${vehicle.id}`}
          coordinate={vehicle.coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.marker} />
        </Marker>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  marker: {
    width: CIRCLE_STYLE.circleRadius * 2,
    height: CIRCLE_STYLE.circleRadius * 2,
    borderRadius: CIRCLE_STYLE.circleRadius,
    backgroundColor: CIRCLE_STYLE.circleColor,
    borderWidth: CIRCLE_STYLE.circleStrokeWidth,
    borderColor: CIRCLE_STYLE.circleStrokeColor,
  },
});

export default VehicleMarkers;
