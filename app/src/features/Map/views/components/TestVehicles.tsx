// app/src/features/Map/views/components/TestVehicles.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';

const ENABLE_TEST_VEHICLES = true;

interface TestVehicle {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  name: string;
}

const TEST_VEHICLES: TestVehicle[] = [
  {
    id: 'test-vehicle-1',
    coordinates: [-85.3082615, 35.0457707],
    name: 'Test Vehicle 1'
  },
  {
    id: 'test-vehicle-2',
    coordinates: [-85.3082476, 35.0457707],
    name: 'Test Vehicle 2'
  }
];

interface TestVehiclesProps {}

export const TestVehicles: React.FC<TestVehiclesProps> = () => {
  if (!ENABLE_TEST_VEHICLES) {
    return null;
  }

  return (
    <>
      {TEST_VEHICLES.map((vehicle) => (
        <MapboxGL.MarkerView
          key={vehicle.id}
          coordinate={vehicle.coordinates}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.markerContainer}>
            <View style={styles.marker}>
              <Ionicons name="car" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.label}>{vehicle.name}</Text>
          </View>
        </MapboxGL.MarkerView>
      ))}
    </>
  );
};

export const getTestVehicles = (): TestVehicle[] => {
  return ENABLE_TEST_VEHICLES ? TEST_VEHICLES : [];
};

export const isTestVehiclesEnabled = (): boolean => {
  return ENABLE_TEST_VEHICLES;
};

export const getTestVehicleCount = (): number => {
  return ENABLE_TEST_VEHICLES ? TEST_VEHICLES.length : 0;
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    borderColor: '#FFFFFF',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default TestVehicles;
