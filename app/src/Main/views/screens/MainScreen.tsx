// app/src/Main/views/screens/MainScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { MapViewComponent } from '../../../features/Map/views/components/MapView';
import { LoadingScreen } from '../components/LoadingScreen';
import { MainViewModel } from '../../viewmodels/MainViewModel';

interface MainScreenProps {
  viewModel: MainViewModel;
}

export const MainScreen: React.FC<MainScreenProps> = observer(({ viewModel }) => {
  if (!viewModel.isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <MapViewComponent
        mapViewModel={viewModel.mapViewModel}
        pedestrianDetectorViewModel={viewModel.pedestrianDetectorViewModel}
        testingPedestrianDetectorViewModel={viewModel.testingPedestrianDetectorViewModel}
        testingVehicleDisplayViewModel={null}
        directionGuideViewModel={viewModel.directionGuideViewModel}
        isTestingMode={viewModel.isTestingMode}
        mainViewModel={viewModel}
        spatViewModel={viewModel.spatViewModel}
        lanesViewModel={viewModel.lanesViewModel}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});


