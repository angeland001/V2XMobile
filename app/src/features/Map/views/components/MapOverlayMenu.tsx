import React from "react";
import { View, StyleSheet } from "react-native";
import { DarkModeButton } from "./mapoverlay/DarkModeButton";
import { LayersButton } from "./mapoverlay/LayersButton";

interface MapOverlayMenuProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onCycleLayer: () => void;
  navOffset?: number;
}

export const MapOverlayMenu: React.FC<MapOverlayMenuProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onCycleLayer,
  navOffset = 0,
}) => {
  return (
    <View style={[styles.topRight, { top: 80 + navOffset }]}>
      <DarkModeButton isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />
      <View style={styles.buttonGap} />
      <LayersButton onPress={onCycleLayer} />
    </View>
  );
};

const styles = StyleSheet.create({
  topRight: {
    position: "absolute",
    right: 16,
    zIndex: 100,
  },
  buttonGap: {
    height: 8,
  },
});

export default MapOverlayMenu;
