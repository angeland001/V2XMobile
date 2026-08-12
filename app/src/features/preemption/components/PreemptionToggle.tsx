import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';

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
      <Text style={[styles.label, isTablet && styles.labelTablet]}>Auto Preemption</Text>
      <Pressable
        style={[styles.toggle, isTablet && styles.toggleTablet, enabled ? styles.toggleOn : styles.toggleOff]}
        onPress={() => onToggle(!enabled)}
      >
        <View style={[styles.thumb, isTablet && styles.thumbTablet, enabled ? styles.thumbOn : styles.thumbOff]} />
      </Pressable>
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  labelTablet: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
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
    backgroundColor: '#10b981',
  },
  toggleOff: {
    backgroundColor: '#6b7280',
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

export default PreemptionToggle;
