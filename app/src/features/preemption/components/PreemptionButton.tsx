import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface PreemptionButtonProps {
  visible: boolean;
  zoneName?: string;
  onPress: () => void;
  disabled?: boolean;
}

export const PreemptionButton: React.FC<PreemptionButtonProps> = ({
  visible,
  zoneName,
  onPress,
  disabled = false,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.zoneText}>Zone: {zoneName || 'Active SPaT Zone'}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          disabled ? styles.buttonDisabled : null,
          pressed ? styles.buttonPressed : null,
        ]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>Request Preemption</Text>
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
  },
  zoneText: {
    marginBottom: 8,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  button: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 220,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

export default PreemptionButton;
