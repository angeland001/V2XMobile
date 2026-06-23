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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { COLORS } from '../theme';
import { RouteViewModel, GeocodingSuggestion, TimHit, PreemptionHit } from '../../Route/viewmodels/RouteViewModel';
import { TimCategory } from '../../TIM/models/TimTypes';

const TIM_STYLE: Record<TimCategory, { bg: string; border: string; accent: string; icon: string }> = {
  safety:        { bg: 'rgba(239,68,68,0.06)',  border: '#EF4444', accent: '#EF4444', icon: 'warning' },
  regulatory:    { bg: 'rgba(245,158,11,0.06)', border: '#F59E0B', accent: '#F59E0B', icon: 'ban' },
  informational: { bg: 'rgba(59,130,246,0.06)', border: '#3B82F6', accent: '#3B82F6', icon: 'information-circle' },
};

function formatTimType(raw: string): string {
  return raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
    if (!hasTime) return datePart;
    const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${datePart} at ${timePart}`;
  } catch {
    return null;
  }
}

function SeverityDots({ value }: { value: number }): React.ReactElement {
  const total = 5;
  const filled = Math.min(value, total);
  const color = value >= 4 ? '#EF4444' : value >= 3 ? '#F59E0B' : '#22C55E';
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: COLORS.textDim, fontWeight: '600', marginRight: 2 }}>Severity Risk</Text>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: i < filled ? color : 'rgba(0,0,0,0.1)',
          }}
        />
      ))}
      <Text style={{ fontSize: 10, color, fontWeight: '700', marginLeft: 2 }}>{value}/5</Text>
    </View>
  );
}

interface RouteScreenProps {
  routeViewModel: RouteViewModel;
}

export const RouteScreen: React.FC<RouteScreenProps> = observer(({ routeViewModel }) => {
  const geocodeDebounceRef = useRef<NodeJS.Timeout | null>(null);

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
        <View style={styles.header}>
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
                    onPress={() => routeViewModel.selectToSuggestion(s)}
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
              onPress={() => routeViewModel.getRoute()}
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

          {/* Active route card */}
          {routeViewModel.hasActiveRoute && (
            <View style={styles.activeRouteCard}>
              <View style={styles.activeRouteHeader}>
                <View style={styles.activeRouteTitleRow}>
                  <Ionicons name="navigate" size={14} color={COLORS.orange} />
                  <Text style={styles.activeRouteTitle}>Active Route</Text>
                  {routeViewModel.isRerouting && (
                    <View style={styles.reroutingBadge}>
                      <Text style={styles.reroutingText}>REROUTING</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => routeViewModel.clearRoute()} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textDim} />
                </TouchableOpacity>
              </View>

              <Text style={styles.activeRouteDestLabel} numberOfLines={1}>
                {routeViewModel.toLabel}
              </Text>

              <View style={styles.routeMeta}>
                <Text style={styles.activeRouteDuration}>{routeViewModel.routeDuration}</Text>
                <Text style={styles.activeRouteDistance}>{routeViewModel.routeDistance}</Text>
              </View>

              {/* TIM zone detail cards */}
              {routeViewModel.timHits.map((hit: TimHit) => {
                const s = TIM_STYLE[hit.category];
                const validFrom = formatDate(hit.validFrom);
                const validUntil = formatDate(hit.validUntil);
                return (
                  <View key={hit.timId} style={[styles.timDetailCard, { backgroundColor: s.bg, borderColor: s.border }]}>
                    {/* Header row */}
                    <View style={styles.timDetailHeader}>
                      <View style={[styles.timCategoryPill, { borderColor: s.border }]}>
                        <Ionicons name={s.icon as any} size={11} color={s.accent} />
                        <Text style={[styles.timCategoryLabel, { color: s.accent }]}>
                          {hit.category.toUpperCase()}
                        </Text>
                      </View>
                      <SeverityDots value={hit.severity} />
                    </View>

                    {/* Type */}
                    <Text style={styles.timTypeLabel}>{formatTimType(hit.timType)}</Text>

                    {/* Description */}
                    {hit.description !== null && (
                      <Text style={styles.timDescription}>{hit.description}</Text>
                    )}

                    {/* ITIS codes */}
                    {hit.itisCodes.length > 0 && (
                      <View style={styles.timMetaRow}>
                        <Text style={styles.timMetaKey}>ITIS</Text>
                        <Text style={styles.timMetaValue}>{hit.itisCodes.join(', ')}</Text>
                      </View>
                    )}

                    {/* Validity window */}
                    {(validFrom || validUntil) && (
                      <View style={styles.timMetaRow}>
                        <Ionicons name="time-outline" size={11} color={COLORS.textDim} />
                        <Text style={styles.timMetaValue}>
                          {validFrom && validUntil
                            ? `${validFrom} – ${validUntil}`
                            : validFrom
                            ? `From ${validFrom}`
                            : `Until ${validUntil}`}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Preemption zone badges */}
              {routeViewModel.preemptionHits.length > 0 && (
                <View style={[styles.timHitsRow, { marginTop: routeViewModel.timHits.length > 0 ? 6 : 0 }]}>
                  {routeViewModel.preemptionHits.map((hit: PreemptionHit) => (
                    <View
                      key={hit.zoneId}
                      style={[styles.timHitBadge, { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: '#8B5CF6' }]}
                    >
                      <Ionicons name="flash" size={11} color="#8B5CF6" />
                      <Text style={[styles.timHitBadgeText, { color: '#8B5CF6' }]}>
                        {hit.zoneName.toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {routeViewModel.timHits.length === 0 && routeViewModel.preemptionHits.length === 0 && (
                <View style={styles.timClearRow}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
                  <Text style={styles.timClearText}>No TIM or preemption zones on this route</Text>
                </View>
              )}
            </View>
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
  activeRouteCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.orange,
    padding: 14,
    marginBottom: 20,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  activeRouteHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  activeRouteTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeRouteTitle:     { fontSize: 13, fontWeight: '700', color: COLORS.orange, letterSpacing: 0.3 },
  reroutingBadge:       { backgroundColor: COLORS.orangeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.orange, marginLeft: 4 },
  reroutingText:        { fontSize: 9, fontWeight: '700', color: COLORS.orange, letterSpacing: 0.8 },
  activeRouteDestLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  routeMeta:            { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  activeRouteDuration:  { fontSize: 22, fontWeight: '700', color: COLORS.orange },
  activeRouteDistance:  { fontSize: 13, color: COLORS.textSecondary },
  timHitsRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timHitBadge:          { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  timHitBadgeText:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  timClearRow:          { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timClearText:         { fontSize: 12, color: '#22C55E' },
  timDetailCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 5,
  },
  timDetailHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timCategoryPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  timCategoryLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  timTypeLabel:      { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  timDescription:    { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  timMetaRow:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timMetaKey:        { fontSize: 10, fontWeight: '700', color: COLORS.textDim, letterSpacing: 0.5 },
  timMetaValue:      { fontSize: 11, color: COLORS.textSecondary },
  sectionLabel:         { fontSize: 10, color: COLORS.textDim, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  v2xNote:              { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 12 },
  v2xNoteText:          { flex: 1, fontSize: 11, color: COLORS.textDim, lineHeight: 16 },
});

export default RouteScreen;
