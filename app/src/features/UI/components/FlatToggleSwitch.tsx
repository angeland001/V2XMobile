import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ROUTE_COLORS } from '../appTheme';

interface FlatToggleSwitchProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

// Flat, no-shadow pill for the engineering-plan-sheet screens (Settings and
// similar hairline/ink-on-paper surfaces). ToggleSwitch (PreemptionToggle's
// shadowed pill) reads as a floating sticker in a flat bordered-card list —
// it earns the shadow only by sitting on top of live map/camera footage,
// which this context doesn't have. Track colors mirror ToggleRow's own
// rowIcon chip (amberDim/panelRaised) so the switch and the icon beside it
// read as one active/inactive language instead of two.
export const FlatToggleSwitch: React.FC<FlatToggleSwitchProps> = ({ enabled, onToggle }) => {
  return (
    <Pressable
      style={[styles.track, enabled ? styles.trackOn : styles.trackOff]}
      onPress={() => onToggle(!enabled)}
    >
      <View style={[styles.thumb, enabled ? styles.thumbOn : styles.thumbOff]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  trackOn: {
    backgroundColor: ROUTE_COLORS.amberDim,
    borderColor: ROUTE_COLORS.amberBorder,
  },
  trackOff: {
    backgroundColor: ROUTE_COLORS.panelRaised,
    borderColor: ROUTE_COLORS.hairline,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  thumbOn: {
    backgroundColor: ROUTE_COLORS.amber,
    alignSelf: 'flex-end',
  },
  thumbOff: {
    backgroundColor: ROUTE_COLORS.steelDim,
    alignSelf: 'flex-start',
  },
});

export default FlatToggleSwitch;
