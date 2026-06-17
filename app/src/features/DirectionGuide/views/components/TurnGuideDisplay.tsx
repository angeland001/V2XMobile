// app/src/features/DirectionGuide/views/components/TurnGuideDisplay.tsx

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { TurnIcon, TurnSignalState } from './TurnIcon';
import { SpatViewModel } from '../../../SpatService/viewModels/SpatViewModel';
import { SignalState } from '../../../SpatService/models/SpatModels';

interface TurnGuideDisplayProps {
  spatViewModel: SpatViewModel;
}

function mapSignalStateToTurnState(signalState: SignalState): TurnSignalState {
  switch (signalState) {
    case SignalState.GREEN:
      return TurnSignalState.ALLOWED;
    case SignalState.YELLOW:
      return TurnSignalState.WARNING;
    case SignalState.RED:
      return TurnSignalState.PROHIBITED;
    default:
      return TurnSignalState.PROHIBITED;
  }
}

export const TurnGuideDisplay: React.FC<TurnGuideDisplayProps> = observer(({ 
  spatViewModel 
}) => {
  // Record display event - SIMPLIFIED FOR GEORGIA ONLY
  useEffect(() => {
    if (spatViewModel.shouldShowDisplay && 
        spatViewModel.currentSignalGroup !== null &&
        spatViewModel.signalState !== SignalState.UNKNOWN) {
      

    }
  }, [
    spatViewModel.shouldShowDisplay,
    spatViewModel.currentSignalGroup,
    spatViewModel.signalState
  ]);

  if (!spatViewModel.shouldShowDisplay) {
    return null;
  }

  const currentLaneId = spatViewModel.currentLaneId;
  const currentLaneIds = spatViewModel.currentLaneIds;

  if (!currentLaneId && currentLaneIds.length === 0) {
    return null;
  }

  const turnState = mapSignalStateToTurnState(spatViewModel.signalState);

  const hasLane = (laneId: number): boolean => currentLaneIds.includes(laneId) || currentLaneId === laneId;

  const isGeorgiaLanes4_5 = hasLane(4) || hasLane(5);
  const isGeorgiaLane1 = hasLane(1);
  const isGeorgiaLane8 = hasLane(8);
  const isGeorgiaLanes10_11 = hasLane(10) || hasLane(11);

  // Lane 1: Right and Straight with Yield
  if (isGeorgiaLane1) {
    return (
      <View style={styles.container}>
        <View style={styles.laneContainer}>
          <View style={styles.iconWrapper}>
            <Text style={styles.laneLabel}>Right Lane</Text>
            <View style={styles.iconContainer}>
              <TurnIcon 
                leftTurn={TurnSignalState.PROHIBITED}
                straightTurn={turnState}
                rightTurn={TurnSignalState.ALLOWED}
                showLeft={false}
                size={55}
              />
            </View>
            <Text style={styles.yieldWarning}>⚠️ YIELD</Text>
          </View>
          <View style={[styles.statusDot, styles.yieldDot]} />
        </View>
      </View>
    );
  }

  // Lane 8: Right and Straight (both follow traffic signal)
  if (isGeorgiaLane8) {
    return (
      <View style={styles.container}>
        <View style={styles.laneContainer}>
          <View style={styles.iconWrapper}>
            <Text style={styles.laneLabel}>Right Lane</Text>
            <View style={styles.iconContainer}>
              <TurnIcon 
                leftTurn={TurnSignalState.PROHIBITED}
                straightTurn={turnState}
                rightTurn={turnState}
                showLeft={false}
                size={55}
              />
            </View>
          </View>
          <View style={styles.statusDot} />
        </View>
      </View>
    );
  }

  // Lanes 4 & 5: Left Turn Lane + Left Lane (both follow traffic signal)
  if (isGeorgiaLanes4_5) {
    return (
      <View style={styles.container}>
        <View style={styles.laneContainer}>
          <View style={styles.iconWrapper}>
            <Text style={styles.laneLabel}>Turning Lane</Text>
            <View style={styles.iconContainer}>
              <TurnIcon 
                leftTurn={turnState}
                straightTurn={TurnSignalState.PROHIBITED}
                rightTurn={TurnSignalState.PROHIBITED}
                showStraight={false}
                showRight={false}
                size={55}
              />
            </View>
          </View>
          <View style={styles.statusDot} />
        </View>

        <View style={styles.laneContainer}>
          <View style={styles.iconWrapper}>
            <Text style={styles.laneLabel}>Left Lane</Text>
            <View style={styles.iconContainer}>
              <TurnIcon 
                leftTurn={TurnSignalState.PROHIBITED}
                straightTurn={turnState}
                rightTurn={turnState}
                showLeft={false}
                size={55}
              />
            </View>
          </View>
          <View style={styles.statusDot} />
        </View>
      </View>
    );
  }

  // Lanes 10 & 11: Show both lane containers
  if (isGeorgiaLanes10_11) {
    return (
      <View style={styles.container}>
        {/* Lane 11: Middle Lane - Left and Straight */}
        <View style={styles.laneContainer}>
          <View style={styles.iconWrapper}>
            <Text style={styles.laneLabel}>Middle Lane</Text>
            <View style={styles.iconContainer}>
              <TurnIcon 
                leftTurn={turnState}
                straightTurn={turnState}
                rightTurn={TurnSignalState.PROHIBITED}
                showLeft={true}
                showStraight={true}
                showRight={false}
                size={55}
              />
            </View>
          </View>
          <View style={styles.statusDot} />
        </View>

        {/* Lane 10: Right Lane - Right Turn and Straight */}
        <View style={styles.laneContainer}>
          <View style={styles.iconWrapper}>
            <Text style={styles.laneLabel}>Right Lane</Text>
            <View style={styles.iconContainer}>
              <TurnIcon 
                leftTurn={TurnSignalState.PROHIBITED}
                straightTurn={turnState}
                rightTurn={turnState}
                showLeft={false}
                showStraight={true}
                showRight={true}
                size={55}
              />
            </View>
          </View>
          <View style={styles.statusDot} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.laneContainer}>
        <View style={styles.iconWrapper}>
          <Text style={styles.laneLabel}>{spatViewModel.currentZoneName || 'Active Zone'}</Text>
          <View style={styles.iconContainer}>
            <TurnIcon
              leftTurn={TurnSignalState.PROHIBITED}
              straightTurn={turnState}
              rightTurn={TurnSignalState.PROHIBITED}
              showLeft={false}
              showRight={false}
              size={55}
            />
          </View>
          <Text style={styles.zoneMeta}>SG {spatViewModel.currentSignalGroup ?? '-'}</Text>
        </View>
        <View style={styles.statusDot} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 150,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    zIndex: 1000,
  },
  laneContainer: {
    alignItems: 'center',
  },
  iconWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 20,
    padding: 12,
    paddingTop: 8,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    minWidth: 85,
  },
  laneLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  yieldWarning: {
    fontSize: 8,
    fontWeight: '900',
    color: '#f59e0b',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(245, 158, 11, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  zoneMeta: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1a73e8',
    marginTop: 6,  
    opacity: 0.8,
    elevation: 2,
    shadowColor: '#1a73e8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
  },
  yieldDot: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
  },
});

export default TurnGuideDisplay;