import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel } from '../viewmodels/RouteViewModel';

interface Props {
  routeViewModel: RouteViewModel;
  onBannerLayout?: (height: number) => void;
}

function getManeuverIcon(type: string, modifier?: string): keyof typeof Ionicons.glyphMap {
  if (type === 'arrive') return 'flag';
  if (type === 'depart') return 'navigate';
  if (type === 'roundabout' || type === 'rotary') return 'repeat';
  if (type === 'fork') return 'git-branch-outline';
  if (type === 'merge') return 'git-merge-outline';

  switch (modifier) {
    case 'uturn':        return 'return-up-back';
    case 'sharp right':  return 'arrow-redo';
    case 'right':        return 'arrow-forward-circle-outline';
    case 'slight right': return 'arrow-forward';
    case 'straight':     return 'arrow-up-circle-outline';
    case 'slight left':  return 'arrow-back';
    case 'left':         return 'arrow-back-circle-outline';
    case 'sharp left':   return 'arrow-undo';
    default:             return 'arrow-up';
  }
}

export const NavigationBanner: React.FC<Props> = observer(({ routeViewModel, onBannerLayout }) => {
  if (!routeViewModel.isNavigating) return null;

  // Arrived state
  if (routeViewModel.hasArrived) {
    return (
      <View
        style={styles.container}
        onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#22C55E' }]}>
          <Ionicons name="flag" size={28} color="#fff" />
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.distance, { color: '#22C55E' }]}>Arrived!</Text>
          <Text style={styles.street} numberOfLines={1}>
            {routeViewModel.toLabel}
          </Text>
        </View>
      </View>
    );
  }

  // Rerouting state
  if (routeViewModel.isRerouting) {
    return (
      <View
        style={styles.container}
        onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#6B7280' }]}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.distance, { color: '#6B7280' }]}>Recalculating…</Text>
          <Text style={styles.street}>Finding best route</Text>
        </View>
      </View>
    );
  }

  const step = routeViewModel.currentStep;
  if (!step) return null;

  const iconName = getManeuverIcon(step.maneuverType, step.maneuverModifier);
  const dist = routeViewModel.distanceToManeuverFormatted;
  const nextStep = routeViewModel.nextStep;

  // Show the road you're heading TO next, not the road you're currently on
  const nextRoadName = nextStep && nextStep.maneuverType !== 'arrive' && nextStep.name
    ? nextStep.name
    : (step.name || step.instruction);

  return (
    <View
      style={styles.container}
      onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={iconName} size={28} color="#fff" />
      </View>

      <View style={styles.textColumn}>
        <View style={styles.primaryRow}>
          {dist !== '' && <Text style={styles.distance}>{dist}</Text>}
          <Text style={styles.street} numberOfLines={1}>
            {nextRoadName}
          </Text>
        </View>
        <Text style={styles.instruction} numberOfLines={1}>
          {step.instruction}
        </Text>
        {nextStep && nextStep.maneuverType !== 'arrive' && (
          <Text style={styles.nextStep} numberOfLines={1}>
            Then: {nextStep.instruction}
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 48,  // status bar
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 14,
    zIndex: 3000,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF8C00',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#FF8C00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  distance: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  street: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    flexShrink: 1,
  },
  instruction: {
    fontSize: 13,
    color: 'rgba(26,26,46,0.6)',
    fontWeight: '400',
  },
  nextStep: {
    fontSize: 11,
    color: 'rgba(26,26,46,0.4)',
    marginTop: 2,
  },
});

export default NavigationBanner;
