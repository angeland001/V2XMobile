import React, { useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const PANEL_WIDTH = 168;
const TAB_WIDTH = 22;
const HEIGHT = 46;

const NAV_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "git-branch-outline",   label: "Route"   },
  { icon: "car-outline",          label: "Traffic" },
  { icon: "warning-outline",      label: "Alerts"  },
  { icon: "partly-sunny-outline", label: "Weather" },
];

export const NavigationDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  // Start at -PANEL_WIDTH so only the tab peeks at the screen edge
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  const toggle = () => {
    Animated.spring(slideAnim, {
      toValue: isOpen ? -PANEL_WIDTH : 0,
      useNativeDriver: true,
      tension: 130,
      friction: 13,
    }).start();
    setIsOpen((prev) => !prev);
  };

  return (
    <View style={styles.anchor}>
      {/*
        The entire bar (panel + tab) moves as one unit.
        translateX: -PANEL_WIDTH → tab sits at screen left edge (panel hidden off-screen)
        translateX:  0           → full bar visible, tab at the far right end
      */}
      <Animated.View
        style={[styles.bar, { transform: [{ translateX: slideAnim }] }]}
      >
        {/* Nav items — left portion of the bar */}
        <View style={styles.panel}>
          {NAV_ITEMS.map((item) => (
            <View key={item.label} style={styles.navItem}>
              <Ionicons name={item.icon} size={16} color="#fff" />
              <Text style={styles.navLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Arrow tab — always at the right end of the bar */}
        <TouchableOpacity style={styles.tab} onPress={toggle} activeOpacity={0.8}>
          <Ionicons
            name={isOpen ? "chevron-back" : "chevron-forward"}
            size={14}
            color="#fff"
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Anchor at left:0 — the bar slides left/right relative to this
  anchor: {
    position: "absolute",
    left: 0,
    top: 136, // compass top(80) + compass height(46) + 10px gap
    zIndex: 100,
  },

  // Full bar: panel content + tab in a row
  bar: {
    flexDirection: "row",
    height: HEIGHT,
  },

  // Left section: nav items
  panel: {
    width: PANEL_WIDTH,
    height: HEIGHT,
    backgroundColor: "#E87722",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 8,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },

  navLabel: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },

  // Right section: the arrow tab — rounded on the right, always at bar's trailing edge
  tab: {
    width: TAB_WIDTH,
    height: HEIGHT,
    backgroundColor: "#E87722",
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
