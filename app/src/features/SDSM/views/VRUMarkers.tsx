// app/src/features/SDSM/views/VRUMarkers.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { observer } from 'mobx-react-lite';
import { VRUData } from '../models/SDSMTypes';

interface VRUMarkersProps {
  vrus: VRUData[];
  isActive: boolean;
  getMapboxCoordinates: (vru: VRUData) => [number, number];
}


export const VRUMarkers: React.FC<VRUMarkersProps> = observer(({ vrus, isActive, getMapboxCoordinates }) => {
  if (!isActive || vrus.length === 0) {
    return null;
  }

  return (
    <>
      {vrus.map((vru) => {
        const mapboxCoords = getMapboxCoordinates(vru);

        // Safety check for coordinates
        if (!mapboxCoords || mapboxCoords.length !== 2 ||
            typeof mapboxCoords[0] !== 'number' ||
            typeof mapboxCoords[1] !== 'number' ||
            mapboxCoords[0] === 0 || mapboxCoords[1] === 0) {
          return null;
        }

        return (
          <MapboxGL.PointAnnotation
            key={`sdsm-vru-${vru.id}`}
            id={`sdsm-vru-${vru.id}`}
            coordinate={mapboxCoords}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.vruIcon}>
              <View style={styles.vruIconInner} />
            </View>
          </MapboxGL.PointAnnotation>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  vruIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF6B35',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vruIconInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});