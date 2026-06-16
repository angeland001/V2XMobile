// app/src/features/SDSM/views/VRUMarkers.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { observer } from 'mobx-react-lite';
import { VRUData } from '../models/SDSMTypes';
import { isValidLngLat, toGoogleLatLng } from '../../../core/maps/coordinates';

interface VRUMarkersProps {
  vrus: VRUData[];
  isActive: boolean;
  getMapCoordinates: (vru: VRUData) => [number, number];
}

const CIRCLE_STYLE = {
  circleRadius: 9,
  circleColor: '#FF6B35',
  circleStrokeWidth: 3,
  circleStrokeColor: '#FFFFFF',
} as const;

export const VRUMarkers: React.FC<VRUMarkersProps> = observer(({ vrus, isActive, getMapCoordinates }) => {
  if (!isActive || vrus.length === 0) return null;

  const markers = vrus
    .map((vru) => {
      const coords = getMapCoordinates(vru);
      if (!isValidLngLat(coords) || coords[0] === 0 || coords[1] === 0) return null;
      return { id: String(vru.id), coordinate: toGoogleLatLng(coords) };
    })
    .filter(Boolean);

  if (markers.length === 0) return null;

  return (
    <>
      {markers.map((marker) => marker && (
        <Marker
          key={`sdsm-vru-${marker.id}`}
          identifier={`sdsm-vru-${marker.id}`}
          coordinate={marker.coordinate}
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
