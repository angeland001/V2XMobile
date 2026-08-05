// app/src/features/SDSM/views/VRUMarkers.tsx
import React from 'react';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VRUData } from '../models/SDSMTypes';
import { isValidLngLat } from '../../../core/maps/coordinates';
import { PedestrianIcon } from '../../UI/components/icons/PedestrianIcon';
import { MarkerPin, MARKER_PIN_TIP_ANCHOR } from '../../UI/components/icons/MarkerPin';
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
          anchor={{ x: 0.5, y: MARKER_PIN_TIP_ANCHOR }}
        >
          <MarkerPin size={30} iconSize={13} color={COLORS.blue}>
            <PedestrianIcon size={13} color={COLORS.white} />
          </MarkerPin>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
});

export default VRUMarkers;
