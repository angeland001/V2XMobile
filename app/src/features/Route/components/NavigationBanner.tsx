import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel } from '../viewmodels/RouteViewModel';

interface Props {
  routeViewModel: RouteViewModel;
  onBannerLayout?: (height: number) => void;
}

// A phone screen is this wide, give or take — on a wide car display the
// banner is sized to match rather than stretching edge to edge, so it
// reads as a compact card floating over the map instead of a strip that
// eats the whole top of a screen many times wider than it needs.
const PHONE_CARD_WIDTH = 380;

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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Car displays run wide-and-short (landscape, little vertical room to
  // spare); phones run tall-and-narrow. Detect by aspect ratio rather than
  // an absolute size, so it also does the right thing for a phone rotated
  // to landscape. In this mode the banner drops the phone-style status-bar
  // padding, shrinks down, cuts the lowest-priority line, and shrinks to a
  // phone-width floating card instead of stretching across the whole display.
  const isWide = width > height * 1.3;

  if (!routeViewModel.isNavigating) return null;

  const containerDynamicStyle = isWide
    ? {
        top: insets.top + 10,
        left: 16,
        width: PHONE_CARD_WIDTH,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
      }
    : {
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 10,
        paddingBottom: 14,
        gap: 14,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
      };
  const iconCircleSize = isWide ? 36 : 58;
  const iconCircleDynamicStyle = {
    width: iconCircleSize,
    height: iconCircleSize,
    borderRadius: iconCircleSize / 2,
  };
  const iconSize = isWide ? 18 : 28;

  // Arrived state
  if (routeViewModel.hasArrived) {
    return (
      <View
        style={[styles.container, containerDynamicStyle]}
        onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
      >
        <View style={[styles.iconCircle, iconCircleDynamicStyle, { backgroundColor: '#22C55E' }]}>
          <Ionicons name="flag" size={iconSize} color="#fff" />
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.distance, isWide && styles.distanceWide, { color: '#22C55E' }]}>Arrived!</Text>
          <Text style={[styles.street, isWide && styles.streetWide]} numberOfLines={1}>
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
        style={[styles.container, containerDynamicStyle]}
        onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
      >
        <View style={[styles.iconCircle, iconCircleDynamicStyle, { backgroundColor: '#6B7280' }]}>
          <ActivityIndicator color="#fff" size="small" />
        </View>
        <View style={styles.textColumn}>
          <Text style={[styles.distance, isWide && styles.distanceWide, { color: '#6B7280' }]}>Recalculating…</Text>
          <Text style={[styles.street, isWide && styles.streetWide]}>Finding best route</Text>
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
      style={[styles.container, containerDynamicStyle]}
      onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
    >
      <View style={[styles.iconCircle, iconCircleDynamicStyle]}>
        <Ionicons name={iconName} size={iconSize} color="#fff" />
      </View>

      <View style={styles.textColumn}>
        <View style={styles.primaryRow}>
          {dist !== '' && <Text style={[styles.distance, isWide && styles.distanceWide]}>{dist}</Text>}
          <Text style={[styles.street, isWide && styles.streetWide]} numberOfLines={1}>
            {nextRoadName}
          </Text>
        </View>
        <Text style={[styles.instruction, isWide && styles.instructionWide]} numberOfLines={1}>
          {step.instruction}
        </Text>
        {/* "Then: ..." preview is the lowest-priority line — cut on wide
            (car) layouts where vertical space is scarce. */}
        {!isWide && nextStep && nextStep.maneuverType !== 'arrive' && (
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    zIndex: 3000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
  },
  iconCircle: {
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
  distanceWide: {
    fontSize: 18,
  },
  street: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    flexShrink: 1,
  },
  streetWide: {
    fontSize: 14,
  },
  instruction: {
    fontSize: 13,
    color: 'rgba(26,26,46,0.6)',
    fontWeight: '400',
  },
  instructionWide: {
    fontSize: 11,
  },
  nextStep: {
    fontSize: 11,
    color: 'rgba(26,26,46,0.4)',
    marginTop: 2,
  },
});

export default NavigationBanner;
