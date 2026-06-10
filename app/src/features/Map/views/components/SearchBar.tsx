import React from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  isDarkMode?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ isDarkMode = false }) => {
  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Ionicons
        name="search"
        size={18}
        color={isDarkMode ? "#9AA3B0" : "#9AA3B0"}
        style={styles.icon}
      />
      <TextInput
        style={[styles.input, isDarkMode && styles.inputDark]}
        placeholder="Search Destinations"
        placeholderTextColor="#9AA3B0"
        editable={false}
        pointerEvents="none"
      />
      <TouchableOpacity style={styles.micButton} activeOpacity={0.7}>
        <Ionicons
          name="mic-outline"
          size={18}
          color={isDarkMode ? "#9AA3B0" : "#9AA3B0"}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 30,
    left: 70,
    right: 70,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 100,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  containerDark: {
    backgroundColor: "#1E2A3A",
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1C1C2E",
    padding: 0,
  },
  inputDark: {
    color: "#E0E6EF",
  },
  micButton: {
    padding: 4,
    marginLeft: 4,
  },
});
