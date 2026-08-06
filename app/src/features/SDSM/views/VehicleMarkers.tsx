// app/src/features/SDSM/views/VehicleMarkers.tsx
import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VehicleDisplayViewModel } from '../viewmodels/VehicleDisplayViewModel';
import { isValidLngLat } from '../../../core/maps/coordinates';
import { CarIcon } from '../../UI/components/icons/CarIcon';
import { MarkerPin, MARKER_PIN_TIP_ANCHOR } from '../../UI/components/icons/MarkerPin';
import COLORS from '../../UI/theme';

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
          anchor={{ x: 0.5, y: MARKER_PIN_TIP_ANCHOR }}
        >
          <MarkerPin size={34} iconSize={15} color={COLORS.orange}>
            <CarIcon size={15} color={COLORS.white} />
          </MarkerPin>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
});

export default VehicleMarkers;
