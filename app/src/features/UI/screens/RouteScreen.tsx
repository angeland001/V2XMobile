import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

const RECENT_ROUTES = [
  { id: '1', from: 'Current Location', to: 'UTC Campus – Chattanooga',  duration: '12 min', distance: '4.2 mi', hasTim: false },
  { id: '2', from: 'Current Location', to: 'Erlanger Hospital',          duration: '8 min',  distance: '2.1 mi', hasTim: true  },
  { id: '3', from: 'Current Location', to: 'Chattanooga Airport',        duration: '22 min', distance: '9.4 mi', hasTim: false },
];

export const RouteScreen: React.FC = () => {
  const [fromText, setFromText] = useState('');
  const [toText, setToText]     = useState('');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerAccent} />
        <View>
          <Text style={styles.headerTitle}>Route</Text>
          <Text style={styles.headerSub}>V2X-aware navigation</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Search block */}
        <View style={styles.searchCard}>
          <View style={styles.inputRow}>
            <View style={[styles.dotRing, { borderColor: COLORS.orange }]}>
              <View style={[styles.dot, { backgroundColor: COLORS.orange }]} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="From — current location"
              placeholderTextColor={COLORS.textDim}
              value={fromText}
              onChangeText={setFromText}
              selectionColor={COLORS.orange}
            />
          </View>

          <View style={styles.inputDivider} />

          <View style={styles.inputRow}>
            <View style={[styles.dotRing, { borderColor: COLORS.red }]}>
              <View style={[styles.dot, { backgroundColor: COLORS.red }]} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="To — enter destination"
              placeholderTextColor={COLORS.textDim}
              value={toText}
              onChangeText={setToText}
              selectionColor={COLORS.orange}
            />
          </View>

          <TouchableOpacity style={styles.swapBtn} activeOpacity={0.7}>
            <Ionicons name="swap-vertical" size={16} color={COLORS.orange} />
          </TouchableOpacity>
        </View>

        {(fromText.length > 0 || toText.length > 0) && (
          <TouchableOpacity style={styles.goBtn} activeOpacity={0.85}>
            <Ionicons name="navigate" size={16} color={COLORS.white} />
            <Text style={styles.goBtnText}>Get Route</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>RECENT ROUTES</Text>

        {RECENT_ROUTES.map((route) => (
          <TouchableOpacity key={route.id} style={styles.routeCard} activeOpacity={0.75}>
            <View style={styles.routeLeft}>
              <View style={styles.routeTrack}>
                <View style={[styles.trackDot, { backgroundColor: COLORS.orange }]} />
                <View style={styles.trackLine} />
                <View style={[styles.trackDot, { backgroundColor: COLORS.red }]} />
              </View>
              <View style={styles.routeText}>
                <Text style={styles.routeFrom} numberOfLines={1}>{route.from}</Text>
                <Text style={styles.routeTo}   numberOfLines={1}>{route.to}</Text>
              </View>
            </View>
            <View style={styles.routeRight}>
              <Text style={styles.routeDuration}>{route.duration}</Text>
              <Text style={styles.routeDistance}>{route.distance}</Text>
              {route.hasTim && (
                <View style={styles.timBadge}>
                  <Text style={styles.timBadgeText}>⚠ TIM</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.v2xNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.textDim} />
          <Text style={styles.v2xNoteText}>
            Routes are checked against active TIM broadcast zones before departure.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerAccent: {
    width: 4,
    height: 36,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    gap: 10,
  },
  dotRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    height: '100%',
  },
  inputDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 28,
  },
  swapBtn: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.orangeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtn: {
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  sectionLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  routeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  routeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  routeTrack: {
    alignItems: 'center',
    width: 14,
    gap: 3,
  },
  trackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trackLine: {
    width: 1.5,
    height: 14,
    backgroundColor: COLORS.border,
  },
  routeText: {
    flex: 1,
  },
  routeFrom: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  routeTo: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  routeRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  routeDuration: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.orange,
  },
  routeDistance: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  timBadge: {
    backgroundColor: COLORS.orangeBg,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
    borderWidth: 1,
    borderColor: COLORS.orange,
  },
  timBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.orangeDeep,
  },
  v2xNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 12,
  },
  v2xNoteText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textDim,
    lineHeight: 16,
  },
});

export default RouteScreen;
