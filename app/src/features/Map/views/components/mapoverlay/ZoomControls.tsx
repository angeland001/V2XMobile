import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useResponsiveLayout } from "../../../../UI/hooks/useResponsiveLayout";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateUser: () => void;
  navOffset?: number;
}

// Matches the scale factor MapView.tsx uses to keep MapOverlayMenu's
// docked position in sync with these buttons' real size.
const TABLET_SCALE = 1.3;

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onLocateUser,
  navOffset = 0,
}) => {
  const { isTablet } = useResponsiveLayout();
  const scale = isTablet ? TABLET_SCALE : 1;
  const buttonSize = 44 * scale;
  const buttonStyle = { width: buttonSize, height: buttonSize, borderRadius: 10 * scale };
  const gapSize = 8 * scale;
  const iconSize = 22 * scale;
  const locateIconSize = 20 * scale;

  return (
    <View style={[styles.container, { bottom: 110 + navOffset }]}>
      {/* Zoom In */}
      <TouchableOpacity style={[styles.grayButton, buttonStyle]} onPress={onZoomIn} activeOpacity={0.75}>
        <Ionicons name="add" size={iconSize} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={{ height: gapSize }} />

      {/* Zoom Out */}
      <TouchableOpacity style={[styles.grayButton, buttonStyle]} onPress={onZoomOut} activeOpacity={0.75}>
        <Ionicons name="remove" size={iconSize} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={{ height: gapSize }} />

      {/* Locate User */}
      <TouchableOpacity style={[styles.yellowButton, buttonStyle]} onPress={onLocateUser} activeOpacity={0.75}>
        <Ionicons name="locate" size={locateIconSize} color="#1C1C2E" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    zIndex: 100,
    alignItems: "center",
  },
  grayButton: {
    backgroundColor: "#47515c",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  yellowButton: {
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default ZoomControls;
