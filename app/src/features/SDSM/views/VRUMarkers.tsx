// app/src/features/SDSM/views/VRUMarkers.tsx
import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VRUData } from '../models/SDSMTypes';
import { isValidLngLat } from '../../../core/maps/coordinates';

interface VRUMarkersProps {
  vrus: VRUData[];
  isActive: boolean;
  getMapCoordinates: (vru: VRUData) => [number, number];
}

export const VRUMarkers: React.FC<VRUMarkersProps> = observer(({ vrus, isActive, getMapCoordinates }) => {
  if (!isActive || vrus.length === 0) return null;

  const features: GeoJSON.Feature<GeoJSON.Point>[] = vrus
    .filter((vru) => {
      const coords = getMapCoordinates(vru);
      return isValidLngLat(coords) && coords[0] !== 0 && coords[1] !== 0;
    })
    .map((vru) => ({
      type: 'Feature',
      properties: { id: String(vru.id) },
      geometry: { type: 'Point', coordinates: getMapCoordinates(vru) },
    }));

  if (features.length === 0) return null;

  const featureCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  return (
    <MapboxGL.ShapeSource id="vru-source" shape={featureCollection}>
      <MapboxGL.CircleLayer
        id="vru-circles"
        style={{
          circleRadius: 9,
          circleColor: '#FF6B35',
          circleStrokeWidth: 3,
          circleStrokeColor: '#FFFFFF',
        }}
      />
    </MapboxGL.ShapeSource>
  );
});

export default VRUMarkers;
