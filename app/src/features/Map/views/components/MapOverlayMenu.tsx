import React from "react";
import { View, StyleSheet } from "react-native";
import { DarkModeButton } from "./mapoverlay/DarkModeButton";
import { LayersButton } from "./mapoverlay/LayersButton";
import { Compass } from "./mapoverlay/Compass";
import { NavigationDrawer } from "./mapoverlay/NavigationDrawer";

interface MapOverlayMenuProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  userHeading: number;
  onCycleLayer: () => void;
}

export const MapOverlayMenu: React.FC<MapOverlayMenuProps> = ({
  isDarkMode,
  onToggleDarkMode,
  userHeading,
  onCycleLayer,
}) => {
  return (
    <>
      {/* Top-left: Compass */}
      <View style={styles.topLeft}>
        <Compass heading={userHeading} />
      </View>

      {/* Left-side navigation drawer — below compass */}
      <NavigationDrawer />

      {/* Top-right: stacked buttons */}
      <View style={styles.topRight}>
        <DarkModeButton isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />
        <View style={styles.buttonGap} />
        <LayersButton onPress={onCycleLayer} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  topLeft: {
    position: "absolute",
    left: 26,
    top: 80,
    zIndex: 100,
  },
  topRight: {
    position: "absolute",
    right: 16,
    top: 80,
    zIndex: 100,
  },
  buttonGap: {
    height: 8,
  },
});
