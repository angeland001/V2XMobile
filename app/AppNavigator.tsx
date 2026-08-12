import React, { useEffect } from 'react';
import { View, StatusBar } from 'react-native';
import { observer } from 'mobx-react-lite';
import { MainViewModel } from './src/Main/viewmodels/MainViewModel';
import { MainNavigator } from './MainNavigator';
import { TimToast } from './src/features/UI/components/TimToast';

const mainViewModel = new MainViewModel();

export const AppNavigator: React.FC = observer(() => {
  useEffect(() => {
    return () => {
      mainViewModel.cleanup();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent animated />
      <MainNavigator viewModel={mainViewModel} />
      <TimToast
        timService={mainViewModel.timService}
        routeViewModel={mainViewModel.routeViewModel}
        settingsViewModel={mainViewModel.settingsViewModel}
        isNavigating={mainViewModel.routeViewModel.isNavigating}
      />
    </View>
  );
});

export default AppNavigator;
