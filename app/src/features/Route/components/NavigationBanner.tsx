import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel } from '../viewmodels/RouteViewModel';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';

interface Props {
  routeViewModel: RouteViewModel;
  onBannerLayout?: (height: number) => void;
}

// A phone screen is this wide, give or take — on a wide car display the
// banner is sized to match rather than stretching edge to edge, so it
// reads as a compact card floating over the map instead of a strip that
// eats the whole top of a screen many times wider than it needs.
const PHONE_CARD_WIDTH = 380;
// On tablet the map region is still roomy even after the nav rail + status
// dock take their share, so the banner gets a bit more room than the
// car-HU-compact width above rather than staying phone-sized.
const TABLET_CARD_WIDTH = 460;

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
  const { isTablet } = useResponsiveLayout();

  if (!routeViewModel.isNavigating) return null;

  const containerDynamicStyle = isWide
    ? {
        top: insets.top + 10,
        left: 16,
        width: isTablet ? TABLET_CARD_WIDTH : PHONE_CARD_WIDTH,
        paddingTop: isTablet ? 10 : 6,
        paddingBottom: isTablet ? 10 : 6,
        gap: isTablet ? 12 : 8,
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
  const iconCircleSize = isTablet ? 48 : isWide ? 36 : 58;
  const iconCircleDynamicStyle = {
    width: iconCircleSize,
    height: iconCircleSize,
    borderRadius: iconCircleSize / 2,
  };
  const iconSize = isTablet ? 22 : isWide ? 18 : 28;

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
          <Text style={[styles.distance, isWide && styles.distanceWide, isTablet && styles.distanceTablet, { color: '#22C55E' }]}>Arrived!</Text>
          <Text style={[styles.street, isWide && styles.streetWide, isTablet && styles.streetTablet]} numberOfLines={1}>
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
          <Text style={[styles.distance, isWide && styles.distanceWide, isTablet && styles.distanceTablet, { color: '#6B7280' }]}>Recalculating…</Text>
          <Text style={[styles.street, isWide && styles.streetWide, isTablet && styles.streetTablet]}>Finding best route</Text>
        </View>
      </View>
    );
  }

  // currentStep is the road already under the vehicle (its own maneuver
  // already happened); nextStep is the upcoming maneuver — the turn the
  // driver actually needs to make next, which is what distanceToManeuver
  // counts down to and what voice guidance announces. See RouteViewModel's
  // triggerVoiceGuidance for the matching logic on the voice side.
  const step = routeViewModel.currentStep;
  if (!step) return null;

  const nextStep = routeViewModel.nextStep;
  const upcoming = nextStep ?? step;

  const iconName = getManeuverIcon(upcoming.maneuverType, upcoming.maneuverModifier);
  const dist = routeViewModel.distanceToManeuverFormatted;
  const upcomingRoadName = upcoming.name || upcoming.instruction;
  const stepAfterNext = routeViewModel.stepAfterNext;

  return (
    <View
      style={[styles.container, containerDynamicStyle]}
      onLayout={e => onBannerLayout?.(e.nativeEvent.layout.height)}
    >
      <View style={[styles.iconCircle, iconCircleDynamicStyle]}>
        <Ionicons name={iconName} size={iconSize} color="#fff" />
      </View>

      <View style={styles.textColumn}>
        {/* Current road first, small — where the driver is right now. */}
        {step.name ? (
          <Text style={styles.currentRoad} numberOfLines={1}>
            {step.name}
          </Text>
        ) : null}
        {/* Upcoming turn, dominant — the actionable instruction. */}
        <View style={styles.primaryRow}>
          {dist !== '' && <Text style={[styles.distance, isWide && styles.distanceWide, isTablet && styles.distanceTablet]}>{dist}</Text>}
          <Text style={[styles.street, isWide && styles.streetWide, isTablet && styles.streetTablet]} numberOfLines={1}>
            {upcomingRoadName}
          </Text>
        </View>
        <Text style={[styles.instruction, isWide && styles.instructionWide, isTablet && styles.instructionTablet]} numberOfLines={1}>
          {upcoming.instruction}
        </Text>
        {/* "Then: ..." preview is the lowest-priority line — cut on wide
            (car) layouts where vertical space is scarce. */}
        {!isWide && stepAfterNext && stepAfterNext.maneuverType !== 'arrive' && (
          <Text style={styles.nextStep} numberOfLines={1}>
            Then: {stepAfterNext.instruction}
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
  currentRoad: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(26,26,46,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  distanceTablet: {
    fontSize: 22,
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
  streetTablet: {
    fontSize: 17,
  },
  instruction: {
    fontSize: 13,
    color: 'rgba(26,26,46,0.6)',
    fontWeight: '400',
  },
  instructionWide: {
    fontSize: 11,
  },
  instructionTablet: {
    fontSize: 14,
  },
  nextStep: {
    fontSize: 11,
    color: 'rgba(26,26,46,0.4)',
    marginTop: 2,
  },
});

export default NavigationBanner;
