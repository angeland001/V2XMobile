import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Polygon } from "react-native-svg";

interface LayersButtonProps {
  onPress: () => void;
}

export const LayersButton: React.FC<LayersButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Svg width={22} height={18} viewBox="0 0 22 18">
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
    width: 44,
    height: 44,
    borderRadius: 10,
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
