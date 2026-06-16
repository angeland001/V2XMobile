// app/src/features/Map/components/HeadingMarker.tsx

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { HeadingService, HeadingData } from '../services/HeadingService';
import { toGoogleLatLng } from '../../../core/maps/coordinates';

interface HeadingMarkerProps {
  coordinate: [number, number]; // [longitude, latitude]
}

export const HeadingMarker: React.FC<HeadingMarkerProps> = ({ coordinate }) => {
  const [heading, setHeading] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = HeadingService.subscribe((data: HeadingData) => {
      setHeading(data.heading);
    });

    return unsubscribe;
  }, []);

  return (
    <Marker
      identifier="user-location-marker"
      coordinate={toGoogleLatLng(coordinate)}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.container}>
        <View style={styles.pulseOuter} />
        <View style={styles.pulseInner} />
        
        <View style={styles.markerBody}>
          <View style={styles.markerInner} />
        </View>

        <View
          style={[
            styles.arrowContainer,
            { transform: [{ rotate: `${heading}deg` }] }
          ]}
        >
          <View style={styles.arrow} />
          <View style={styles.arrowGlow} />
        </View>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseOuter: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  pulseInner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  markerBody: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 10,
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  arrowContainer: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
    elevation: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  arrowGlow: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    top: 6,
  },
});
