import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ROUTE_COLORS, ROUTE_FONTS, TIM_CATEGORY_STYLE } from '../../UI/appTheme';
import { TimHit, PreemptionHit } from '../viewmodels/RouteViewModel';

interface ZoneMarker {
  key: string;
  ratio: number;
  color: string;
}

interface RouteZoneStripProps {
  timHits: TimHit[];
  timPositions: Map<number, number>;
  preemptionHits: PreemptionHit[];
  preemptionPositions: Map<string, number>;
  distanceLabel: string;
}

// A flat list of zone cards tells you *that* five things are on your route,
// not *where* — with a route that's mostly clear except for one cluster
// near the destination, that distinction matters. This renders the route as
// a single mile-marker track between origin and destination, with each TIM/
// preemption hit placed at its actual fractional position instead of buried
// in an unordered list. The detail cards below still carry the full
// description/severity/validity — this is the "where," they're the "what."
export const RouteZoneStrip: React.FC<RouteZoneStripProps> = ({
  timHits,
  timPositions,
  preemptionHits,
  preemptionPositions,
  distanceLabel,
}) => {
  const markers: ZoneMarker[] = [];
  for (const hit of timHits) {
    const ratio = timPositions.get(hit.timId);
    if (ratio != null) markers.push({ key: `tim-${hit.timId}`, ratio, color: TIM_CATEGORY_STYLE[hit.category].color });
  }
  for (const hit of preemptionHits) {
    const ratio = preemptionPositions.get(hit.zoneId);
    if (ratio != null) markers.push({ key: `spat-${hit.zoneId}`, ratio, color: ROUTE_COLORS.preempt });
  }

  if (markers.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {markers.map((m) => (
          <View key={m.key} style={[styles.tick, { left: `${m.ratio * 100}%`, backgroundColor: m.color }]} />
        ))}
      </View>
      <View style={styles.endpointRow}>
        <View style={styles.endpoint}>
          <View style={styles.originDot} />
          <Text style={styles.endpointLabel}>0 MI</Text>
        </View>
        <View style={styles.endpoint}>
          <Text style={styles.endpointLabel}>{distanceLabel.toUpperCase()}</Text>
          <Ionicons name="flag" size={10} color={ROUTE_COLORS.amberText} />
        </View>
      </View>
    </View>
  );
};

const TRACK_HEIGHT = 4;

const styles = StyleSheet.create({
  container: { paddingTop: 4, paddingBottom: 10 },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: ROUTE_COLORS.hairline,
    marginHorizontal: 5,
  },
  tick: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: ROUTE_COLORS.panel,
    marginLeft: -5,
  },
  endpointRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  endpoint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  originDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ROUTE_COLORS.signal },
  endpointLabel: { fontFamily: ROUTE_FONTS.mono, fontSize: 9, color: ROUTE_COLORS.steel, letterSpacing: 0.4 },
});

export default RouteZoneStrip;
