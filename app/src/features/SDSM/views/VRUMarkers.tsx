// app/src/features/SDSM/views/VRUMarkers.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VRUData } from '../models/SDSMTypes';
import { isValidLngLat } from '../../../core/maps/coordinates';
import { PedestrianIcon } from '../../UI/components/icons/PedestrianIcon';

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
          <View style={styles.marker}>
            <PedestrianIcon size={13} color="#0082BF" />
          </View>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
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

export default VRUMarkers;
