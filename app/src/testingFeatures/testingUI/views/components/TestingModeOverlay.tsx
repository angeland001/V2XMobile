// app/src/testingFeatures/testingUI/views/components/TestingModeOverlay.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TestingVehicleDisplayViewModel } from '../../../testingVehicleDisplay/viewmodels/TestingVehicleDisplayViewModel';
interface TestingModeOverlayProps {
  isTestingMode: boolean;
  testingVehicleDisplayViewModel: TestingVehicleDisplayViewModel | null;
}

export const TestingModeOverlay: React.FC<TestingModeOverlayProps> = ({ 
  isTestingMode, 
  testingVehicleDisplayViewModel 
}) => {
  if (!isTestingMode) {
    return null;
  }

  return (
    <>
      {/* Vehicle count indicator (conditionally rendered) */}
      {testingVehicleDisplayViewModel && testingVehicleDisplayViewModel.isActive && (
        <View style={styles.vehicleIndicator}>
          <Text style={styles.vehicleText}>
            🚗 {testingVehicleDisplayViewModel.vehicleCount} vehicles
          </Text>
        </View>
      )}
      
      {/* Future testing UI elements can be added here */}
    </>
  );
};

const styles = StyleSheet.create({
  vehicleIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 255, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    elevation: 3,
  },
  vehicleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default TestingModeOverlay;