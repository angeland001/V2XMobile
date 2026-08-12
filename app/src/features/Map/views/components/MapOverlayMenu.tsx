import React from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { DarkModeButton } from "./mapoverlay/DarkModeButton";
import { LayersButton } from "./mapoverlay/LayersButton";
import { useResponsiveLayout } from "../../../UI/hooks/useResponsiveLayout";

interface MapOverlayMenuProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onCycleLayer: () => void;
  // Docks bottom-right, adjacent to (left of) the zoom controls, rather than
  // stacking above them — both fully parent-controlled so they sit on the
  // same baseline as one cluster instead of colliding on a short screen.
  bottom: number;
  right: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

export const MapOverlayMenu: React.FC<MapOverlayMenuProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onCycleLayer,
  bottom,
  right,
  onLayout,
}) => {
  const { isTablet } = useResponsiveLayout();
  const gap = isTablet ? 10 : 8;

  return (
    <View style={[styles.container, { bottom, right }]} onLayout={onLayout}>
      <DarkModeButton isDarkMode={isDarkMode} onToggle={onToggleDarkMode} />
      <View style={{ height: gap }} />
      <LayersButton onPress={onCycleLayer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 100,
  },
});

export default MapOverlayMenu;
