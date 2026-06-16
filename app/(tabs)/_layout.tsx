// app/(tabs)/_layout.tsx
import React from 'react';
import { StatusBar, SafeAreaView, StyleSheet } from 'react-native';
import { MainScreen } from '../src/Main/views/screens/MainScreen';
import { MainViewModel } from '../src/Main/viewmodels/MainViewModel';
import { initGoogleMaps } from '../src/core/api/googleMaps';

// Initialize Google Maps configuration
initGoogleMaps();

// Create a singleton instance of the MainViewModel
const mainViewModel = new MainViewModel();

const App = () => {
  // Clean up resources when the app is unmounted
  React.useEffect(() => {
    return () => {
      mainViewModel.cleanup();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <MainScreen viewModel={mainViewModel} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
