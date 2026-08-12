import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { ROUTE_COLORS, ROUTE_FONTS } from '../appTheme';
import { TransmissionPulse } from '../../Route/components/TransmissionPulse';
import { LiveBroadcastBadge } from '../../Route/components/LiveBroadcastBadge';
import { RouteViewModel, GeocodingSuggestion, RecentRoute } from '../../Route/viewmodels/RouteViewModel';

interface RouteScreenProps {
  routeViewModel: RouteViewModel;
}

const CONNECTOR_HEIGHT = 22;

export const RouteScreen: React.FC<RouteScreenProps> = observer(({ routeViewModel }) => {
  const geocodeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const handleGetRoute = async () => {
    Keyboard.dismiss();
    await routeViewModel.getRoute();
    // Full-screen takeover: once a route is fetched, hand off to the map tab
    // (RoutePreviewSheet there shows ETA/duration/zones and Start Navigation).
    if (routeViewModel.hasActiveRoute) {
      navigation.navigate('map');
    }
  };

  // Recent-route rows skip the "review then tap Get Route" step a fresh
  // geocoding suggestion requires — the destination was already routed to
  // once before, so selecting it fetches and hands off to the map tab
  // immediately, same end state as handleGetRoute.
  const handleSelectRecent = async (r: RecentRoute) => {
    routeViewModel.selectRecentRoute(r);
    await handleGetRoute();
  };

  const handleToChange = (text: string) => {
    routeViewModel.setToText(text);
    if (geocodeDebounceRef.current) clearTimeout(geocodeDebounceRef.current);
    if (text.length >= 2) {
      geocodeDebounceRef.current = setTimeout(() => {
        routeViewModel.fetchGeocodingSuggestions(text);
      }, 300);
    } else {
      routeViewModel.clearSuggestions();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => routeViewModel.clearSuggestions()}>
      <View style={styles.container}>
        {/* paddingTop adds insets.top on top of the base padding so the title
            clears the status bar / camera cutout instead of rendering under it
            — the screen isn't wrapped in a SafeAreaView, and the app's status
            bar is translucent (see AppNavigator), so nothing else accounts
            for it here. */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAccent} />
            <View>
              <Text style={styles.headerTitle}>ROUTE</Text>
              <Text style={styles.headerSub}>V2X-aware navigation</Text>
            </View>
          </View>
          <LiveBroadcastBadge />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Origin + destination input */}
          <View style={styles.searchCard}>
            <View style={styles.originRow}>
              <View style={[styles.dotRing, styles.originDotRing]}>
                <View style={[styles.dot, { backgroundColor: ROUTE_COLORS.signal }]} />
              </View>
              <Text style={styles.originText}>CURRENT LOCATION</Text>
            </View>

            <View style={styles.connectorRow}>
              <View style={styles.connectorTrack}>
                <TransmissionPulse height={CONNECTOR_HEIGHT} color={ROUTE_COLORS.amber} />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.dotRing, styles.destDotRing]}>
                <View style={[styles.dot, { backgroundColor: ROUTE_COLORS.amber }]} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Where to?"
                placeholderTextColor={ROUTE_COLORS.steelDim}
                value={routeViewModel.toText}
                onChangeText={handleToChange}
                onFocus={() => routeViewModel.setShowSuggestions(routeViewModel.toSuggestions.length > 0)}
                selectionColor={ROUTE_COLORS.amber}
                accessibilityLabel="Destination address"
              />
              {routeViewModel.toText.length > 0 && (
                <TouchableOpacity
                  onPress={() => { routeViewModel.setToText(''); routeViewModel.clearSuggestions(); }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear destination"
                >
                  <Ionicons name="close-circle" size={18} color={ROUTE_COLORS.steel} />
                </TouchableOpacity>
              )}
            </View>

            {/* Autocomplete dropdown */}
            {routeViewModel.showSuggestions && routeViewModel.toSuggestions.length > 0 && (
              <View style={styles.suggestionDropdown}>
                {routeViewModel.toSuggestions.map((s: GeocodingSuggestion) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.suggestionItem}
                    onPress={() => {
                      Keyboard.dismiss();
                      routeViewModel.selectToSuggestion(s);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={s.placeName}
                  >
                    <Ionicons name="location-outline" size={14} color={ROUTE_COLORS.steel} />
                    <Text style={styles.suggestionText} numberOfLines={2}>{s.placeName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Get Route button */}
          {routeViewModel.toCoord !== null && !routeViewModel.hasActiveRoute && (
            <TouchableOpacity
              style={styles.goBtn}
              activeOpacity={0.85}
              onPress={handleGetRoute}
              disabled={routeViewModel.isLoadingRoute}
            >
              {routeViewModel.isLoadingRoute ? (
                <ActivityIndicator size="small" color={ROUTE_COLORS.white} />
              ) : (
                <Ionicons name="navigate" size={16} color={ROUTE_COLORS.white} />
              )}
              <Text style={styles.goBtnText}>
                {routeViewModel.isLoadingRoute ? 'PLOTTING ROUTE…' : 'PLOT ROUTE'}
              </Text>
            </TouchableOpacity>
          )}

          {routeViewModel.routeError !== null && (
            <Text style={styles.errorText}>{routeViewModel.routeError}</Text>
          )}

          {routeViewModel.recentRoutes.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>RECENT ROUTES</Text>
              <View style={styles.recentCard}>
                {routeViewModel.recentRoutes.map((r: RecentRoute, i: number) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.recentItem,
                      i < routeViewModel.recentRoutes.length - 1 && styles.recentItemBorder,
                    ]}
                    onPress={() => handleSelectRecent(r)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Route to ${r.placeName}`}
                  >
                    <Ionicons name="time-outline" size={16} color={ROUTE_COLORS.steel} />
                    <Text style={styles.recentItemText} numberOfLines={1}>{r.placeName}</Text>
                    <Ionicons name="chevron-forward" size={14} color={ROUTE_COLORS.steelDim} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.v2xNote}>
            <Text style={styles.v2xNotePrompt}>{'>'}</Text>
            <Text style={styles.v2xNoteText}>
              Routes are checked against active TIM broadcast zones before departure.
            </Text>
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ROUTE_COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: ROUTE_COLORS.panel,
    borderBottomWidth: 1,
    borderBottomColor: ROUTE_COLORS.amber,
  },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAccent:    { width: 3, height: 32, backgroundColor: ROUTE_COLORS.amber },
  headerTitle:     { fontFamily: ROUTE_FONTS.displayBlack, fontSize: 22, color: ROUTE_COLORS.ink, letterSpacing: 1 },
  headerSub:       { fontFamily: ROUTE_FONTS.body, fontSize: 12, color: ROUTE_COLORS.steel, marginTop: 2 },
  scrollContent:   { padding: 16, paddingBottom: 40 },
  searchCard: {
    backgroundColor: ROUTE_COLORS.panel,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ROUTE_COLORS.hairline,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
  },
  originRow:       { flexDirection: 'row', alignItems: 'center', height: 34, gap: 10 },
  originDotRing:   { borderColor: ROUTE_COLORS.signal },
  destDotRing:     { borderColor: ROUTE_COLORS.amber },
  originText:      { fontFamily: ROUTE_FONTS.monoMedium, fontSize: 11, letterSpacing: 0.5, color: ROUTE_COLORS.steel },
  connectorRow:    { flexDirection: 'row' },
  connectorTrack:  { width: 18, height: CONNECTOR_HEIGHT, alignItems: 'center' },
  inputRow:        { flexDirection: 'row', alignItems: 'center', height: 50, gap: 10 },
  dotRing:         { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot:             { width: 8, height: 8, borderRadius: 4 },
  input:           { flex: 1, fontFamily: ROUTE_FONTS.bodyMedium, fontSize: 14, color: ROUTE_COLORS.ink, height: '100%' },
  suggestionDropdown: {
    backgroundColor: ROUTE_COLORS.panelRaised,
    borderTopWidth: 1,
    borderTopColor: ROUTE_COLORS.hairline,
    marginHorizontal: -14,
    marginBottom: -4,
    zIndex: 100,
  },
  suggestionItem:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ROUTE_COLORS.hairline },
  suggestionText:  { flex: 1, fontFamily: ROUTE_FONTS.body, fontSize: 13, color: ROUTE_COLORS.ink, lineHeight: 18 },
  goBtn: {
    backgroundColor: ROUTE_COLORS.amber,
    borderRadius: 3,
    paddingVertical: 13,
    paddingHorizontal: 32,
    alignSelf: 'center',
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  goBtnText:       { fontFamily: ROUTE_FONTS.displayExtraBold, fontSize: 14, color: ROUTE_COLORS.white, letterSpacing: 0.8 },
  errorText:       { fontFamily: ROUTE_FONTS.bodyMedium, fontSize: 12, color: ROUTE_COLORS.danger, marginBottom: 12, paddingHorizontal: 4 },
  sectionLabel:    { fontFamily: ROUTE_FONTS.displaySemiBold, fontSize: 10, color: ROUTE_COLORS.steel, letterSpacing: 1.5, marginBottom: 10 },
  recentCard: {
    backgroundColor: ROUTE_COLORS.panel,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ROUTE_COLORS.hairline,
    marginBottom: 4,
  },
  recentItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  recentItemBorder: { borderBottomWidth: 1, borderBottomColor: ROUTE_COLORS.hairline },
  recentItemText:   { flex: 1, fontFamily: ROUTE_FONTS.body, fontSize: 13, color: ROUTE_COLORS.ink },
  v2xNote:              { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 12 },
  v2xNotePrompt:        { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 12, color: ROUTE_COLORS.amberText },
  v2xNoteText:          { flex: 1, fontFamily: ROUTE_FONTS.mono, fontSize: 11, color: ROUTE_COLORS.steel, lineHeight: 16 },
});

export default RouteScreen;
