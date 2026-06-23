// app/src/features/Map/views/components/PedestrianMarker.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

interface PedestrianMarkerProps {
  id: number;
  coordinates: [number, number];
  isInCrosswalk?: boolean;
}

export const PedestrianMarker: React.FC<PedestrianMarkerProps> = ({
  id,
  coordinates,
  isInCrosswalk = false
}) => {
  try {
    if (!coordinates || coordinates.length !== 2 ||
        typeof coordinates[0] !== 'number' ||
        typeof coordinates[1] !== 'number') {
      return null;
    }

    // Input is [lat, lon]; Mapbox expects [lng, lat]
    const mapboxCoordinate: [number, number] = [coordinates[1], coordinates[0]];

    return (
      <MapboxGL.MarkerView
        coordinate={mapboxCoordinate}
        anchor={{ x: 0.5, y: 0.5 }}
      >
        <View style={[
          styles.pedestrianMarker,
          isInCrosswalk ? styles.crossingPedestrian : {}
        ]}>
          <View style={styles.markerInner} />
        </View>
      </MapboxGL.MarkerView>
    );
  } catch {
    return null;
  }
};

const styles = StyleSheet.create({
  pedestrianMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF9800',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossingPedestrian: {
    backgroundColor: '#FF3B30',
    borderColor: '#FFFF00',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  }
});

export default PedestrianMarker;
