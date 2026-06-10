import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DarkModeButtonProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

export const DarkModeButton: React.FC<DarkModeButtonProps> = ({
  isDarkMode,
  onToggle,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, isDarkMode ? styles.darkButton : styles.lightButton]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isDarkMode ? "moon" : "sunny"}
        size={22}
        color={isDarkMode ? "#C8D6F0" : "#F5A623"}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
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
