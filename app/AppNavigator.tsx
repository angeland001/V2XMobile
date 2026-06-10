// app/AppNavigator.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, StatusBar, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SplashScreen } from './src/features/Splash/SplashScreen';
import { OnboardingScreen } from './src/features/Onboarding/OnboardingScreen';
import { MainViewModel } from './src/Main/viewmodels/MainViewModel';
import { initMapbox } from './src/core/api/mapbox';
import { MainNavigator } from './MainNavigator';

// Storage key for onboarding completion
const ONBOARDING_COMPLETE_KEY = '@v2x_demo:onboarding_complete';

// Initialize Mapbox
initMapbox();

// Create a singleton instance of the MainViewModel
const mainViewModel = new MainViewModel();

export const AppNavigator: React.FC = () => {
  const [appState, setAppState] = useState<'splash' | 'onboarding' | 'main'>('splash');
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMain, setShowMain] = useState(false);

  // Animation values
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const onboardingOpacity = useRef(new Animated.Value(0)).current;
  const mainOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkOnboardingStatus();

    // Cleanup on unmount
    return () => {
      mainViewModel.cleanup();
    };
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasCompletedOnboarding = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      setIsFirstLaunch(hasCompletedOnboarding !== 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setIsFirstLaunch(true);
    }
  };

  const handleSplashComplete = () => {
    // Transition directly to main (onboarding disabled)
    setShowMain(true);

    Animated.parallel([
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(mainOpacity, {
        toValue: 1,
        duration: 500,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAppState('main');
    });
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');

      setShowMain(true);

      Animated.parallel([
        Animated.timing(onboardingOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(mainOpacity, {
          toValue: 1,
          duration: 400,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setAppState('main');
        setShowOnboarding(false);
      });
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setAppState('main');
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
      setIsFirstLaunch(true);
      setAppState('splash');
      setShowOnboarding(false);
      setShowMain(false);

      splashOpacity.setValue(1);
      onboardingOpacity.setValue(0);
      mainOpacity.setValue(0);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
        animated
      />

      {/* Splash Screen */}
      {(appState === 'splash' || appState === 'onboarding') && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: splashOpacity,
            zIndex: 3,
          }}
          pointerEvents={appState === 'splash' ? 'auto' : 'none'}
        >
          <SplashScreen onAnimationComplete={handleSplashComplete} />
        </Animated.View>
      )}

      {/* Onboarding Screen */}
      {showOnboarding && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: onboardingOpacity,
            zIndex: 2,
          }}
          pointerEvents={appState === 'onboarding' ? 'auto' : 'none'}
        >
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </Animated.View>
      )}

      {/* Main Screen with Curved Bottom Bar */}
      {showMain && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: mainOpacity,
            zIndex: 1,
          }}
          pointerEvents={appState === 'main' ? 'auto' : 'none'}
        >
          <MainNavigator viewModel={mainViewModel} />
        </Animated.View>
      )}
    </View>
  );
};
