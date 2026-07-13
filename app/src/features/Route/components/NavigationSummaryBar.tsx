import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { RouteViewModel } from '../viewmodels/RouteViewModel';
import { TAB_BAR_HEIGHT } from '../../UI/theme';

interface Props {
  routeViewModel: RouteViewModel;
  onOverviewToggle: () => void;
}

export const NavigationSummaryBar: React.FC<Props> = observer(
  ({ routeViewModel, onOverviewToggle }) => {
    if (!routeViewModel.isNavigating) return null;

    const arrived = routeViewModel.hasArrived;

    return (
      <View style={styles.container}>
        {arrived ? (
          // Arrived layout
          <View style={styles.arrivedRow}>
            <View style={styles.arrivedLeft}>
              <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
              <View>
                <Text style={styles.arrivedTitle}>You have arrived</Text>
                <Text style={styles.arrivedSub} numberOfLines={1}>
                  {routeViewModel.toLabel}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.endBtn}
              onPress={() => routeViewModel.clearRoute()}
              activeOpacity={0.8}
            >
              <Text style={styles.endBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Active navigation layout
          <View style={styles.row}>
            {/* Time + ETA */}
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {routeViewModel.remainingDurationFormatted}
              </Text>
              <Text style={styles.statLabel}>
                {routeViewModel.estimatedArrivalTime
                  ? `ETA ${routeViewModel.estimatedArrivalTime}`
                  : 'ETA —'}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Distance */}
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {routeViewModel.remainingDistanceFormatted}
              </Text>
              <Text style={styles.statLabel}>remaining</Text>
            </View>

            <View style={styles.spacer} />

            {/* Overview toggle */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onOverviewToggle}
              activeOpacity={0.7}
            >
              <Ionicons
                name={routeViewModel.isOverviewMode ? 'navigate' : 'map-outline'}
                size={20}
                color={routeViewModel.isOverviewMode ? '#FF8C00' : 'rgba(26,26,46,0.5)'}
              />
            </TouchableOpacity>

            {/* End navigation */}
            <TouchableOpacity
              style={styles.endBtn}
              onPress={() => routeViewModel.clearRoute()}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#fff" />
              <Text style={styles.endBtnText}>End</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 4,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statBlock: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(26,26,46,0.45)',
    fontWeight: '500',
    marginTop: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(26,26,46,0.1)',
  },
  spacer: {
    flex: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Arrived
  arrivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  arrivedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  arrivedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  arrivedSub: {
    fontSize: 12,
    color: 'rgba(26,26,46,0.45)',
    marginTop: 2,
  },
});

export default NavigationSummaryBar;
