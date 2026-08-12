import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useResponsiveLayout } from "../../../../UI/hooks/useResponsiveLayout";

interface DarkModeButtonProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

// Matches ZoomControls' own tablet scale factor — this button docks
// directly beside that button column and should read as the same size tier.
const TABLET_SCALE = 1.3;

export const DarkModeButton: React.FC<DarkModeButtonProps> = ({
  isDarkMode,
  onToggle,
}) => {
  const { isTablet } = useResponsiveLayout();
  const scale = isTablet ? TABLET_SCALE : 1;
  const buttonSize = 44 * scale;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { width: buttonSize, height: buttonSize, borderRadius: 10 * scale },
        isDarkMode ? styles.darkButton : styles.lightButton,
      ]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isDarkMode ? "moon" : "sunny"}
        size={22 * scale}
        color={isDarkMode ? "#C8D6F0" : "#F5A623"}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  lightButton: {
    backgroundColor: "#FFFFFF",
  },
  darkButton: {
    backgroundColor: "#1E2A3A",
  },
});

export default DarkModeButton;
