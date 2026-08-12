import React from 'react';
import { LayoutChangeEvent, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel } from '../viewmodels/RouteViewModel';
import { useResponsiveLayout } from '../../UI/hooks/useResponsiveLayout';

interface Props {
  routeViewModel: RouteViewModel;
  onOverviewToggle: () => void;
  top: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}

// A small corner chip, not a bar spanning the screen — it only needs to
// carry the ETA/distance and the two nav controls (overview toggle, end).
// Positioning is fully parent-controlled (see MapView.tsx): on a wide car
// display it lines up top-right alongside the nav banner; on a phone it
// docks below it instead, since the banner spans the full width there.
export const NavigationSummaryBar: React.FC<Props> = observer(
  ({ routeViewModel, onOverviewToggle, top, onLayout }) => {
    // Hooks must run unconditionally on every render, so the early return
    // for the not-navigating case comes after them (matches NavigationBanner).
    const { isTablet } = useResponsiveLayout();

    if (!routeViewModel.isNavigating) return null;

    const arrived = routeViewModel.hasArrived;
    const iconBtnSize = isTablet ? 32 : 24;
    const smallIconSize = isTablet ? 17 : 13;
    const endIconSize = isTablet ? 14 : 11;

    return (
      <View style={[styles.container, isTablet && styles.containerTablet, { top }]} onLayout={onLayout}>
        {arrived ? (
          <>
            <View style={styles.arrivedRow}>
              <Ionicons name="checkmark-circle" size={isTablet ? 18 : 14} color="#22C55E" />
              <Text style={[styles.arrivedTitle, isTablet && styles.arrivedTitleTablet]} numberOfLines={1}>Arrived</Text>
            </View>
            <TouchableOpacity
              style={[styles.endBtn, isTablet && styles.endBtnTablet]}
              onPress={() => routeViewModel.clearRoute()}
              activeOpacity={0.8}
            >
              <Text style={[styles.endBtnText, isTablet && styles.endBtnTextTablet]}>Done</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{routeViewModel.remainingDurationFormatted}</Text>
              <Text style={[styles.statSep, isTablet && styles.statSepTablet]}>·</Text>
              <Text style={[styles.statValue, isTablet && styles.statValueTablet]}>{routeViewModel.remainingDistanceFormatted}</Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.iconBtn, { width: iconBtnSize, height: iconBtnSize }]}
                onPress={() => routeViewModel.toggleVoiceGuidance()}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={routeViewModel.voiceGuidanceEnabled ? 'volume-high' : 'volume-mute'}
                  size={smallIconSize}
                  color={routeViewModel.voiceGuidanceEnabled ? '#FF8C00' : 'rgba(26,26,46,0.5)'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { width: iconBtnSize, height: iconBtnSize }]}
                onPress={onOverviewToggle}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={routeViewModel.isOverviewMode ? 'navigate' : 'map-outline'}
                  size={smallIconSize}
                  color={routeViewModel.isOverviewMode ? '#FF8C00' : 'rgba(26,26,46,0.5)'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.endBtn, isTablet && styles.endBtnTablet]}
                onPress={() => routeViewModel.clearRoute()}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={endIconSize} color="#fff" />
                <Text style={[styles.endBtnText, isTablet && styles.endBtnTextTablet]}>End</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    minWidth: 128,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  containerTablet: {
    minWidth: 168,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 9,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.2,
  },
  statValueTablet: {
    fontSize: 19,
  },
  statSep: {
    fontSize: 12,
    color: 'rgba(26,26,46,0.3)',
  },
  statSepTablet: {
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  endBtnTablet: {
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  endBtnTextTablet: {
    fontSize: 14,
  },
  arrivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrivedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  arrivedTitleTablet: {
    fontSize: 15,
  },
});

export default NavigationSummaryBar;
