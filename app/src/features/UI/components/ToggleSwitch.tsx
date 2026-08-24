import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ROUTE_COLORS } from '../appTheme';

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isTablet?: boolean;
  // Track color while off. Defaults to a translucent white, right for
  // sitting over the live map/dark HUD chrome (PreemptionToggle's original
  // context) — callers on a light panel background (SettingsScreen) pass a
  // solid neutral instead so it doesn't read as a barely-visible ghost.
  trackOffColor?: string;
}

// Shared "on = amber" pill switch — originated on PreemptionToggle (the
// map-overlay Auto Preemption control) and pulled out here so
// SettingsScreen's toggle rows use the exact same control instead of the
// generic native Switch, keeping one switch design across the app.
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  onToggle,
  isTablet = false,
  trackOffColor = 'rgba(255,255,255,0.2)',
}) => {
  return (
    <Pressable
      style={[
        styles.toggle,
        isTablet && styles.toggleTablet,
        enabled ? styles.toggleOn : { backgroundColor: trackOffColor },
      ]}
      onPress={() => onToggle(!enabled)}
    >
      <View style={[styles.thumb, isTablet && styles.thumbTablet, enabled ? styles.thumbOn : styles.thumbOff]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 2,
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  toggleTablet: {
    width: 72,
    height: 40,
    borderRadius: 20,
  },
  toggleOn: {
    backgroundColor: ROUTE_COLORS.amber,
  },
  thumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  thumbTablet: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  thumbOn: {
    alignSelf: 'flex-end',
  },
  thumbOff: {
    alignSelf: 'flex-start',
  },
});

export default ToggleSwitch;
