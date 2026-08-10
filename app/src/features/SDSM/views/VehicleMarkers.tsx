// app/src/features/SDSM/views/VehicleMarkers.tsx
import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VehicleDisplayViewModel } from '../viewmodels/VehicleDisplayViewModel';
import { isValidLngLat } from '../../../core/maps/coordinates';
import { CarIcon } from '../../UI/components/icons/CarIcon';
import { EntityBadge } from '../../UI/components/icons/EntityBadge';
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
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <EntityBadge size={16} iconSize={9} color={COLORS.orange}>
            <CarIcon size={9} color={COLORS.white} />
          </EntityBadge>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
});

export default VehicleMarkers;
