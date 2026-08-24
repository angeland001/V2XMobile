import React from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';
import { ROUTE_COLORS, ROUTE_FONTS } from '../../UI/appTheme';
import { ToggleSwitch } from '../../UI/components/ToggleSwitch';

interface PreemptionToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  top: number;
  // Docks top-right instead of top-left — used on wide car displays while
  // navigating, where it stacks under the ETA chip instead of sitting over
  // on the left where the traffic light panel needs the room.
  dockRight?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}

export const PreemptionToggle: React.FC<PreemptionToggleProps> = ({ enabled, onToggle, top, dockRight = false, onLayout }) => {
  const { isTablet } = useResponsiveLayout();

  return (
    <View
      style={[styles.container, dockRight ? styles.containerRight : styles.containerLeft, { top }]}
      onLayout={onLayout}
    >
      {/* Amber border/icon while armed mirrors PreemptionStatusBanner's
          "requesting" accent — same color reads as "system will act" in
          both places instead of the toggle using its own unrelated palette. */}
      <View style={[styles.label, isTablet && styles.labelTablet, enabled && styles.labelArmed]}>
        <Ionicons
          name="flash"
          size={isTablet ? 15 : 12}
          color={enabled ? ROUTE_COLORS.amber : 'rgba(255,255,255,0.55)'}
          style={styles.labelIcon}
        />
        <Text style={[styles.labelText, isTablet && styles.labelTextTablet]}>Auto Preemption</Text>
      </View>
      <ToggleSwitch enabled={enabled} onToggle={onToggle} isTablet={isTablet} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1200,
    alignItems: 'center',
    gap: 8,
  },
  containerLeft: {
    left: 26,
  },
  containerRight: {
    right: 16,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(27, 29, 34, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  labelArmed: {
    borderColor: ROUTE_COLORS.amberBorder,
  },
  labelTablet: {
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  labelIcon: {
    marginRight: 6,
  },
  labelText: {
    fontFamily: ROUTE_FONTS.bodySemiBold,
    color: '#ffffff',
    fontSize: 12,
  },
  labelTextTablet: {
    fontSize: 15,
  },
});

export default PreemptionToggle;
