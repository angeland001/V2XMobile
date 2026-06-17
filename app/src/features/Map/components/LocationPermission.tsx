// app/src/features/Map/components/LocationPermission.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';

interface LocationPermissionProps {
  onPermissionGranted: () => void;
}

export const LocationPermission: React.FC<LocationPermissionProps> = ({ onPermissionGranted }) => {
  const [status, setStatus] = useState<string | null>(null);

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setStatus(status);
      
      if (status === 'granted') {
        onPermissionGranted();
      }
    } catch (error) {
      setStatus('error');
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  if (status === 'granted') {
    return null; // Don't render anything if permission is granted
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Permission Required</Text>
      <Text style={styles.description}>
        This app needs access to your location to show it on the map.
      </Text>
      <TouchableOpacity style={styles.button} onPress={requestPermission}>
        <Text style={styles.buttonText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LocationPermission;