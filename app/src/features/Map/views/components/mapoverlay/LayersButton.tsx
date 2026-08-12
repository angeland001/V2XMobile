import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { useResponsiveLayout } from "../../../../UI/hooks/useResponsiveLayout";

interface LayersButtonProps {
  onPress: () => void;
}

// Matches ZoomControls' own tablet scale factor — this button docks
// directly beside that button column and should read as the same size tier.
const TABLET_SCALE = 1.3;

export const LayersButton: React.FC<LayersButtonProps> = ({ onPress }) => {
  const { isTablet } = useResponsiveLayout();
  const scale = isTablet ? TABLET_SCALE : 1;
  const buttonSize = 44 * scale;

  return (
    <TouchableOpacity
      style={[styles.button, { width: buttonSize, height: buttonSize, borderRadius: 10 * scale }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Svg width={22 * scale} height={18 * scale} viewBox="0 0 22 18">
        {/* Bottom layer — red */}
        <Polygon
          points="1,12 11,17 21,12 11,7"
          fill="#fcb42bff"
          strokeLinejoin="round"
          stroke="#fcb42bff"
          strokeWidth={2}
        />
        {/* Top layer — yellow */}
        <Polygon
          points="1,6 11,11 21,6 11,1"
          fill="#ff5e35ff"
          strokeLinejoin="round"
          stroke="#ff5e35ff"
          strokeWidth={2}
        />
      </Svg>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default LayersButton;
