import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateUser: () => void;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onLocateUser,
}) => {
  return (
    <View style={styles.container}>
      {/* Zoom In */}
      <TouchableOpacity style={styles.grayButton} onPress={onZoomIn} activeOpacity={0.75}>
        <Ionicons name="add" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.gap} />

      {/* Zoom Out */}
      <TouchableOpacity style={styles.grayButton} onPress={onZoomOut} activeOpacity={0.75}>
        <Ionicons name="remove" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.gap} />

      {/* Locate User */}
      <TouchableOpacity style={styles.yellowButton} onPress={onLocateUser} activeOpacity={0.75}>
        <Ionicons name="locate" size={20} color="#1C1C2E" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    bottom: 110,
    zIndex: 100,
    alignItems: "center",
  },
  grayButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
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
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gap: {
    height: 8,
  },
});
