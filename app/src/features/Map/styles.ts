// src/features/Map/styles.ts
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  userMarker: { 
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  navigatingMarker: { 
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: '#FFFF00', // Yellow border to indicate navigation mode
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  directionIndicator: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFF00',
    transform: [{ rotate: '180deg' }],
    top: -14,
  },
  destinationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EA4335',
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
  },
  pedestrianMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF9800',  // Default orange
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossingPedestrian: {
    backgroundColor: '#FF3B30',  // Bright red for pedestrians in crosswalk
    borderColor: '#FFFF00',      // Yellow border
    width: 20,                   // Slightly larger
    height: 20,
    borderRadius: 10,
  },
  dangerPedestrian: {
    backgroundColor: '#FF0000',  // Bright red for pedestrians in danger
    borderColor: '#FFFF00',      // Yellow border
    borderWidth: 3,              // Thicker border
    width: 24,                   // Larger size
    height: 24,
    borderRadius: 12,
  },

});

export default styles;