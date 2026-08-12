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
import { COLORS } from '../theme';
import { RouteViewModel, GeocodingSuggestion } from '../../Route/viewmodels/RouteViewModel';

interface RouteScreenProps {
  routeViewModel: RouteViewModel;
}

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
          <View style={styles.headerAccent} />
          <View>
            <Text style={styles.headerTitle}>Route</Text>
            <Text style={styles.headerSub}>V2X-aware navigation</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Destination input */}
          <View style={styles.searchCard}>
            <View style={styles.inputRow}>
              <View style={[styles.dotRing, { borderColor: COLORS.red }]}>
                <View style={[styles.dot, { backgroundColor: COLORS.red }]} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Where to?"
                placeholderTextColor={COLORS.textDim}
                value={routeViewModel.toText}
                onChangeText={handleToChange}
                onFocus={() => routeViewModel.setShowSuggestions(routeViewModel.toSuggestions.length > 0)}
                selectionColor={COLORS.orange}
              />
              {routeViewModel.toText.length > 0 && (
                <TouchableOpacity
                  onPress={() => { routeViewModel.setToText(''); routeViewModel.clearSuggestions(); }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.textDim} />
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
                  >
                    <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
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
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="navigate" size={16} color={COLORS.white} />
              )}
              <Text style={styles.goBtnText}>
                {routeViewModel.isLoadingRoute ? 'Getting Route…' : 'Get Route'}
              </Text>
            </TouchableOpacity>
          )}

          {routeViewModel.routeError !== null && (
            <Text style={styles.errorText}>{routeViewModel.routeError}</Text>
          )}

          <Text style={styles.sectionLabel}>RECENT ROUTES</Text>

          <View style={styles.v2xNote}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textDim} />
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
  container:       { flex: 1, backgroundColor: COLORS.bg },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerAccent:    { width: 4, height: 36, borderRadius: 2, backgroundColor: COLORS.orange },
  headerTitle:     { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  headerSub:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  scrollContent:   { padding: 16, paddingBottom: 40 },
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
  inputRow:        { flexDirection: 'row', alignItems: 'center', height: 50, gap: 10 },
  dotRing:         { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot:             { width: 8, height: 8, borderRadius: 4 },
  input:           { flex: 1, fontSize: 14, color: COLORS.textPrimary, height: '100%' },
  suggestionDropdown: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginHorizontal: -14,
    marginBottom: -4,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  suggestionItem:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionText:  { flex: 1, fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  goBtn: {
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 32,
    alignSelf: 'center',
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  goBtnText:       { fontSize: 15, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
  errorText:       { fontSize: 12, color: COLORS.red, marginBottom: 12, paddingHorizontal: 4 },
  sectionLabel:         { fontSize: 10, color: COLORS.textDim, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  v2xNote:              { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 12 },
  v2xNoteText:          { flex: 1, fontSize: 11, color: COLORS.textDim, lineHeight: 16 },
});

export default RouteScreen;
