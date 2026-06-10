// app/MainNavigator.tsx
import React from "react";
import { TouchableOpacity, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { NavigationIndependentTree } from "@react-navigation/core";
import { CurvedBottomBarExpo } from "react-native-curved-bottom-bar";
import { MainScreen } from "./src/Main/views/screens/MainScreen";
import { MainViewModel } from "./src/Main/viewmodels/MainViewModel";
import HomeScreenContent from "./(tabs)/index";
import SettingsScreen from "./src/features/Settings/SettingsScreen";

const ACTIVE_COLOR = "#FF8C00";
const INACTIVE_COLOR = "#7A7A8A";
const BAR_COLOR = "#ffffff";

interface MainNavigatorProps {
  viewModel: MainViewModel;
}

export const MainNavigator: React.FC<MainNavigatorProps> = ({ viewModel }) => {
  // Stable component reference so React Navigation doesn't remount on re-renders
  const MapScreen = React.useCallback(
    () => <MainScreen viewModel={viewModel} />,
    [viewModel],
  );

  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <CurvedBottomBarExpo.Navigator
          type="DOWN"
          initialRouteName="map"
          bgColor={BAR_COLOR}
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
                onPress={() => navigate("map")}
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
            if (routeName === "map") return <View key="map-empty" />;

            const isActive = routeName === selectedTab;
            const tabConfig: Record<
              string,
              { active: string; inactive: string; label: string }
            > = {
              home: { active: "home", inactive: "home-outline", label: "Home" },
              settings: {
                active: "settings",
                inactive: "settings-outline",
                label: "Settings",
              },
            };
            const config = tabConfig[routeName];
            if (!config) return <View />;

            return (
              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => navigate(routeName)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={(isActive ? config.active : config.inactive) as any}
                  size={24}
                  color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR}
                />
                <Text style={[styles.label, isActive && styles.labelActive]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        >
          <CurvedBottomBarExpo.Screen
            name="home"
            component={HomeScreenContent as any}
            position="LEFT"
          />
          <CurvedBottomBarExpo.Screen
            name="map"
            component={MapScreen as any}
            position="CIRCLE"
          />
          <CurvedBottomBarExpo.Screen
            name="settings"
            component={SettingsScreen as any}
            position="RIGHT"
          />
        </CurvedBottomBarExpo.Navigator>
      </NavigationContainer>
    </NavigationIndependentTree>
  );
};

const styles = StyleSheet.create({
  circleBtnWrapper: {
    transform: [{ translateY: -25 }],
  },
  circleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACTIVE_COLOR,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#FF8C00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 3,
  },
  label: {
    fontSize: 10,
    color: INACTIVE_COLOR,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  labelActive: {
    color: ACTIVE_COLOR,
    fontWeight: "700",
  },
});
