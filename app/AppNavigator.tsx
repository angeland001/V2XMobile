import React, { useEffect } from 'react';
import { View, StatusBar } from 'react-native';
import { MainViewModel } from './src/Main/viewmodels/MainViewModel';
import { initGoogleMaps } from './src/core/api/googleMaps';
import { MainNavigator } from './MainNavigator';
import { TimToast } from './src/features/UI/components/TimToast';

initGoogleMaps();

const mainViewModel = new MainViewModel();

export const AppNavigator: React.FC = () => {
  useEffect(() => {
    return () => {
      mainViewModel.cleanup();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent animated />
      <MainNavigator viewModel={mainViewModel} />
      <TimToast timService={mainViewModel.timService} />
    </View>
  );
};

export default AppNavigator;
