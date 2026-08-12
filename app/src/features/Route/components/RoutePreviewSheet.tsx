import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { COLORS } from '../../UI/theme';
import { RouteViewModel, TimHit, PreemptionHit } from '../viewmodels/RouteViewModel';
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

interface RoutePreviewSheetProps {
  routeViewModel: RouteViewModel;
  onLayout?: (e: LayoutChangeEvent) => void;
}

// Apple-Maps-style bottom dialog shown while a route is fetched but the user
// hasn't started turn-by-turn yet — destination, ETA/duration/distance,
// selectable route alternatives, and any TIM/preemption zones the route
// crosses. The tab bar is hidden for the whole hasActiveRoute lifetime (see
// MainNavigator), so this can safely dock to the true screen bottom.
export const RoutePreviewSheet: React.FC<RoutePreviewSheetProps> = observer(
  ({ routeViewModel: routeVM, onLayout }) => {
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();

    if (!routeVM.hasActiveRoute || routeVM.isNavigating) return null;

    return (
      <View
        style={[styles.container, { paddingBottom: insets.bottom + 12, maxHeight: screenHeight * 0.55 }]}
        onLayout={onLayout}
      >
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.destLabel} numberOfLines={1}>{routeVM.toLabel}</Text>
            {routeVM.isRerouting && (
              <View style={styles.reroutingBadge}>
                <Text style={styles.reroutingText}>REROUTING</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => routeVM.clearRoute()}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={24} color={COLORS.textDim} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.etaLabel}>Arrive</Text>
            <Text style={styles.etaValue}>{routeVM.estimatedArrivalTime}</Text>
          </View>
          <View style={styles.statsDivider} />
          <View>
            <Text style={styles.durationValue}>{routeVM.routeDuration}</Text>
            <Text style={styles.distanceValue}>{routeVM.routeDistance}</Text>
          </View>
        </View>

        {routeVM.routeOptions.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.optionsRow}
          >
            {routeVM.routeOptions.map((option, index) => {
              const selected = index === routeVM.selectedRouteIndex;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                  onPress={() => routeVM.selectRouteOption(index)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.optionChipDuration, selected && styles.optionChipTextSelected]}>
                    {option.durationLabel}
                  </Text>
                  <Text style={[styles.optionChipDistance, selected && styles.optionChipTextSelected]}>
                    {option.distanceLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <ScrollView showsVerticalScrollIndicator={false} style={styles.zoneScroll}>
          {routeVM.timHits.length > 0 && (
            <View style={styles.zoneSection}>
              <Text style={styles.zoneSectionLabel}>
                TIM ZONES ({routeVM.timHits.length})
              </Text>
              {routeVM.timHits.map((hit: TimHit) => {
                const s = TIM_STYLE[hit.category];
                const validFrom = formatDate(hit.validFrom);
                const validUntil = formatDate(hit.validUntil);
                return (
                  <View key={hit.timId} style={[styles.timDetailCard, { backgroundColor: s.bg, borderColor: s.border }]}>
                    <View style={styles.timDetailHeader}>
                      <View style={[styles.timCategoryPill, { borderColor: s.border }]}>
                        <Ionicons name={s.icon as any} size={11} color={s.accent} />
                        <Text style={[styles.timCategoryLabel, { color: s.accent }]}>
                          {hit.category.toUpperCase()}
                        </Text>
                      </View>
                      <SeverityDots value={hit.severity} />
                    </View>

                    <Text style={styles.timTypeLabel}>{formatTimType(hit.timType)}</Text>

                    {hit.description !== null && (
                      <Text style={styles.timDescription}>{hit.description}</Text>
                    )}

                    {hit.itisCodes.length > 0 && (
                      <View style={styles.timMetaRow}>
                        <Text style={styles.timMetaKey}>ITIS</Text>
                        <Text style={styles.timMetaValue}>{hit.itisCodes.join(', ')}</Text>
                      </View>
                    )}

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
            </View>
          )}

          {routeVM.preemptionHits.length > 0 && (
            <View style={styles.zoneSection}>
              <Text style={styles.zoneSectionLabel}>
                PREEMPTION ZONES ({routeVM.preemptionHits.length})
              </Text>
              <View style={styles.timHitsRow}>
                {routeVM.preemptionHits.map((hit: PreemptionHit) => (
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
            </View>
          )}

          {routeVM.timHits.length === 0 && routeVM.preemptionHits.length === 0 && (
            <View style={styles.timClearRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
              <Text style={styles.timClearText}>No TIM or preemption zones on this route</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.startNavBtn}
          onPress={() => routeVM.startNavigation()}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={styles.startNavBtnText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 3000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  header:          { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  headerTextCol:   { flex: 1, marginRight: 12, gap: 4 },
  destLabel:       { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  reroutingBadge:  { backgroundColor: COLORS.orangeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.orange, alignSelf: 'flex-start' },
  reroutingText:   { fontSize: 9, fontWeight: '700', color: COLORS.orange, letterSpacing: 0.8 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  etaLabel:        { fontSize: 11, color: COLORS.textDim, fontWeight: '600' },
  etaValue:        { fontSize: 24, fontWeight: '800', color: COLORS.orange, letterSpacing: -0.3 },
  statsDivider:    { width: 1, height: 32, backgroundColor: COLORS.border },
  durationValue:   { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  distanceValue:   { fontSize: 13, color: COLORS.textSecondary },
  optionsRow:      { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  optionChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  optionChipSelected: {
    borderColor: COLORS.orange,
    backgroundColor: COLORS.orangeBg,
  },
  optionChipDuration: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  optionChipDistance: { fontSize: 11, color: COLORS.textSecondary },
  optionChipTextSelected: { color: COLORS.orangeDeep },
  zoneScroll:      { flexGrow: 0 },
  zoneSection:     { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  zoneSectionLabel:{ fontSize: 9, fontWeight: '800', color: COLORS.textDim, letterSpacing: 1, marginBottom: 6 },
  timHitsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timHitBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  timHitBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  timClearRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10 },
  timClearText:    { fontSize: 12, color: '#22C55E' },
  timDetailCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 5,
  },
  timDetailHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timCategoryPill:  { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  timCategoryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  timTypeLabel:     { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  timDescription:   { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  timMetaRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timMetaKey:       { fontSize: 10, fontWeight: '700', color: COLORS.textDim, letterSpacing: 0.5 },
  timMetaValue:     { fontSize: 11, color: COLORS.textSecondary },
  startNavBtn: {
    marginTop: 12,
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  startNavBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
});

export default RoutePreviewSheet;
