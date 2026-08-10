// app/src/features/SDSM/views/VRUMarkers.tsx
import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VRUData } from '../models/SDSMTypes';
import { isValidLngLat } from '../../../core/maps/coordinates';
import { PedestrianIcon } from '../../UI/components/icons/PedestrianIcon';
import { EntityBadge } from '../../UI/components/icons/EntityBadge';
import COLORS from '../../UI/theme';

interface VRUMarkersProps {
  vrus: VRUData[];
  isActive: boolean;
  getMapCoordinates: (vru: VRUData) => [number, number];
}

export const VRUMarkers: React.FC<VRUMarkersProps> = observer(({ vrus, isActive, getMapCoordinates }) => {
  if (!isActive || vrus.length === 0) return null;

  const visibleVrus = vrus.filter((vru) => {
    const coords = getMapCoordinates(vru);
    return isValidLngLat(coords) && coords[0] !== 0 && coords[1] !== 0;
  });

  return (
    <>
      {visibleVrus.map((vru) => (
        <MapboxGL.MarkerView
          key={String(vru.id)}
          coordinate={getMapCoordinates(vru)}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <EntityBadge size={14} iconSize={8} color={COLORS.blue}>
            <PedestrianIcon size={8} color={COLORS.white} />
          </EntityBadge>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
});

export default VRUMarkers;
