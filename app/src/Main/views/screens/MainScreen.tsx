import React from 'react';
import { View, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { MapViewComponent } from '../../../features/Map/views/components/MapView';
import { RoutePreviewMapScreen } from '../../../features/Route/components/RoutePreviewMapScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { MainViewModel } from '../../viewmodels/MainViewModel';

interface MainScreenProps {
  viewModel: MainViewModel;
}

export const MainScreen: React.FC<MainScreenProps> = observer(({ viewModel }) => {
  if (!viewModel.isInitialized) {
    return <LoadingScreen />;
  }

  const routeVM = viewModel.routeViewModel;

  // Route fetched but turn-by-turn hasn't started — hand off to the bare
  // preview map (route + relevant zones + summary dialog) instead of the
  // full live-driving map and its HUD. Once Start Navigation is tapped,
  // isNavigating flips and this swaps back to MapViewComponent below.
  if (routeVM.hasActiveRoute && !routeVM.isNavigating) {
    return (
      <View style={styles.container}>
        <RoutePreviewMapScreen routeViewModel={routeVM} />
      </View>
    );
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
        preemptionViewModel={viewModel.preemptionViewModel}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MainScreen;
