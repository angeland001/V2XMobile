import React, { useCallback, useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { NavigationIndependentTree } from '@react-navigation/core';
import { CurvedBottomBarExpo, ICurvedBottomBarRef } from 'react-native-curved-bottom-bar';
import { observer } from 'mobx-react-lite';
import { MainScreen } from './src/Main/views/screens/MainScreen';
import { MainViewModel } from './src/Main/viewmodels/MainViewModel';
import { RouteScreen } from './src/features/UI/screens/RouteScreen';
import { AlertsScreen } from './src/features/UI/screens/AlertsScreen';
import { SettingsScreen } from './src/features/UI/screens/SettingsScreen';

const ACTIVE_COLOR = '#FF8C00';
const INACTIVE_COLOR = '#7A7A8A';
const BAR_COLOR = '#ffffff';

interface MainNavigatorProps {
  viewModel: MainViewModel;
}

const TAB_CONFIG: Record<string, { active: string; inactive: string; label: string }> = {
  route:    { active: 'git-branch',    inactive: 'git-branch-outline',    label: 'Route'    },
  alerts:   { active: 'notifications', inactive: 'notifications-outline', label: 'Alerts'   },
  settings: { active: 'settings',      inactive: 'settings-outline',      label: 'Settings' },
};

export const MainNavigator: React.FC<MainNavigatorProps> = observer(({ viewModel }) => {
  const MapScreen = useCallback(
    () => <MainScreen viewModel={viewModel} />,
    [viewModel],
  );

  const AlertsScreenWrapped = useCallback(
    () => <AlertsScreen timService={viewModel.timService} />,
    [viewModel],
  );

  const SettingsScreenWrapped = useCallback(
    () => <SettingsScreen settingsViewModel={viewModel.settingsViewModel} />,
    [viewModel],
  );

  const RouteScreenWrapped = useCallback(
    () => <RouteScreen routeViewModel={viewModel.routeViewModel} />,
    [viewModel],
  );

  const unread = viewModel.timService.unreadAlertCount;

  // The tab bar (Route/Alerts/Settings + map circle) only gets in the way
  // while turn-by-turn is active — hide it for the extra screen height, and
  // bring it back the moment navigation ends.
  const navigatorRef = useRef<ICurvedBottomBarRef | null>(null);
  const isNavigating = viewModel.routeViewModel.isNavigating;
  useEffect(() => {
    navigatorRef.current?.setVisible(!isNavigating);
  }, [isNavigating]);

  // Same wide-car-display detection used across the nav HUD (see
  // NavigationBanner). There the bar defaults to the full window width,
  // which stretches an already-roomy 4-item tab bar edge to edge — cap it
  // to a phone-like width and let the library's own alignSelf: 'center'
  // handle keeping it centered.
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isWide = screenWidth > screenHeight * 1.3;
  const navBarWidth = isWide ? Math.min(440, screenWidth - 32) : undefined;

  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <CurvedBottomBarExpo.Navigator
          ref={navigatorRef}
          type="DOWN"
          initialRouteName="map"
          bgColor={BAR_COLOR}
          width={navBarWidth}
          circleWidth={60}
          height={65}
          borderTopLeftRight
          borderColor="transparent"
          borderWidth={0}
          id="main-navigator"
          style={{}}
          screenOptions={{ headerShown: false }}
          renderCircle={({ navigate }: { navigate: (tab: string) => void }) => (
            <View style={styles.circleBtnWrapper}>
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={() => navigate('map')}
                activeOpacity={0.85}
              >
                <Ionicons name="map" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}
          tabBar={({
            routeName,
            selectedTab,
            navigate,
          }: {
            routeName: string;
            selectedTab: string;
            navigate: (tab: string) => void;
          }) => {
            if (routeName === 'map') return <View key="map-empty" />;
            const isActive = routeName === selectedTab;
            const config = TAB_CONFIG[routeName];
            if (!config) return <View />;

            const showBadge = routeName === 'alerts' && unread > 0;

            return (
              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => navigate(routeName)}
                activeOpacity={0.7}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={(isActive ? config.active : config.inactive) as any}
                    size={24}
                    color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                  />
                  {showBadge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unread > 9 ? '9+' : String(unread)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.label, isActive && styles.labelActive]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        >
          <CurvedBottomBarExpo.Screen
            name="route"
            component={RouteScreenWrapped as any}
            position="LEFT"
          />
          <CurvedBottomBarExpo.Screen
            name="map"
            component={MapScreen as any}
            position="CIRCLE"
          />
          <CurvedBottomBarExpo.Screen
            name="alerts"
            component={AlertsScreenWrapped as any}
            position="LEFT"
          />
          <CurvedBottomBarExpo.Screen
            name="settings"
            component={SettingsScreenWrapped as any}
            position="RIGHT"
          />
        </CurvedBottomBarExpo.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
});

const styles = StyleSheet.create({
  circleBtnWrapper: {
    transform: [{ translateY: -25 }],
  },
  circleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACTIVE_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    color: INACTIVE_COLOR,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
  },
});

export default MainNavigator;
