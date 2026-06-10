import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface PreemptionToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const PreemptionToggle: React.FC<PreemptionToggleProps> = ({ enabled, onToggle }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Auto Preemption</Text>
      <Pressable
        style={[styles.toggle, enabled ? styles.toggleOn : styles.toggleOff]}
        onPress={() => onToggle(!enabled)}
      >
        <View style={[styles.thumb, enabled ? styles.thumbOn : styles.thumbOff]} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 92,
    alignSelf: 'center',
    zIndex: 1200,
    alignItems: 'center',
    gap: 8,
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
  thumbOn: {
    alignSelf: 'flex-end',
  },
  thumbOff: {
    alignSelf: 'flex-start',
  },
});
