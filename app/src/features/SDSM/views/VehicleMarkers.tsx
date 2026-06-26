// app/src/features/SDSM/views/VehicleMarkers.tsx
import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VehicleDisplayViewModel } from '../viewmodels/VehicleDisplayViewModel';
import { isValidLngLat } from '../../../core/maps/coordinates';

interface VehicleMarkersProps {
  viewModel: VehicleDisplayViewModel;
}

export const VehicleMarkers: React.FC<VehicleMarkersProps> = observer(({ viewModel }) => {
  if (!viewModel?.isActive || viewModel.vehicles.length === 0) return null;

  const features: GeoJSON.Feature<GeoJSON.Point>[] = viewModel.vehicles
    .filter((vehicle) => {
      const coords = viewModel.getMapCoordinates(vehicle);
      return isValidLngLat(coords) && coords[0] !== 0 && coords[1] !== 0;
    })
    .map((vehicle) => ({
      type: 'Feature',
      properties: { id: String(vehicle.id) },
      geometry: { type: 'Point', coordinates: viewModel.getMapCoordinates(vehicle) },
    }));

  if (features.length === 0) return null;

  const featureCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  return (
    <MapboxGL.ShapeSource id="vehicles-source" shape={featureCollection}>
      <MapboxGL.CircleLayer
        id="vehicles-circles"
        style={{
          circleRadius: 7,
          circleColor: '#3B82F6',
          circleStrokeWidth: 2,
          circleStrokeColor: '#FFFFFF',
        }}
      />
    </MapboxGL.ShapeSource>
  );
});

export default VehicleMarkers;
