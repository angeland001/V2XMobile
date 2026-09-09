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
import { ROUTE_COLORS, ROUTE_FONTS, TIM_CATEGORY_STYLE } from '../../UI/appTheme';
import { RouteViewModel, TimHit, PreemptionHit } from '../viewmodels/RouteViewModel';
import { RouteZoneStrip } from './RouteZoneStrip';
import { formatTimType, formatDate } from '../../UI/utils/timFormatting';
import { SeverityDots } from '../../UI/components/SeverityDots';

// Rough combined height of everything in the sheet OTHER than the scrollable
// middle section (drag handle + header + stats row + Start Navigation
// button + container padding/safe-area). Used below to cap the scrollable
// section so it — plus the fixed chrome around it — fits inside the sheet's
// own maxHeight (55% of screen) instead of pushing the sheet past it.
const RESERVED_CHROME_HEIGHT = 240;

interface RoutePreviewSheetProps {
  routeViewModel: RouteViewModel;
  onLayout?: (e: LayoutChangeEvent) => void;
}

// Traffic-control-panel-style bottom dialog shown while a route is fetched
// but the user hasn't started turn-by-turn yet — destination, ETA/duration/
// distance, selectable route alternatives, and any TIM/preemption zones the
// route crosses. The tab bar is hidden for the whole hasActiveRoute
// lifetime (see MainNavigator), so this can safely dock to the true screen
// bottom.
//
// Everything between the stats row and the Start Navigation button (route
// alternatives, the zone strip, TIM/preemption detail cards) is one plain
// ScrollView capped at a computed maxHeight — a drag-to-collapse/expand
// version of this previously lived here, but stacking that on top of
// scrollable content caused a run of real layout bugs (a flex:1 ScrollView
// needs a genuinely definite ancestor height, which an *animated* height
// technically provides but interacts badly with everything else competing
// for the same vertical drag gesture). Header/stats/button stay pinned;
// only the middle scrolls, same as AlertsScreen and the rest of the app.
export const RoutePreviewSheet: React.FC<RoutePreviewSheetProps> = observer(
  ({ routeViewModel: routeVM, onLayout }) => {
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();

    // Applied directly as the ScrollView's own maxHeight (not flex) — a
    // maxHeight on a ScrollView constrains its own box regardless of
    // whether its parent's size is definite, so this doesn't need the
    // container chain above it to resolve to a fixed height first.
    const scrollMaxHeight = Math.max(120, screenHeight * 0.55 - RESERVED_CHROME_HEIGHT);

    if (!routeVM.hasActiveRoute || routeVM.isNavigating) return null;

    return (
      <View
        style={[styles.container, { paddingBottom: insets.bottom + 12, maxHeight: screenHeight * 0.55 }]}
        onLayout={onLayout}
      >
        <View style={styles.grabber} />

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
            accessibilityRole="button"
            accessibilityLabel="Close route preview"
          >
            <Ionicons name="close-circle" size={24} color={ROUTE_COLORS.steel} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View>
            <Text style={styles.etaLabel}>ARRIVE</Text>
            <Text style={styles.etaValue}>{routeVM.estimatedArrivalTime}</Text>
          </View>
          <View style={styles.statsDivider} />
          <View>
            <Text style={styles.durationValue}>{routeVM.routeDuration}</Text>
            <Text style={styles.distanceValue}>{routeVM.routeDistance}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: scrollMaxHeight }}
        >
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

          <RouteZoneStrip
            timHits={routeVM.timHits}
            timPositions={routeVM.timHitRoutePositions}
            preemptionHits={routeVM.preemptionHits}
            preemptionPositions={routeVM.preemptionHitRoutePositions}
            distanceLabel={routeVM.routeDistance}
          />

          {routeVM.timHits.length > 0 && (
            <View style={styles.zoneSection}>
              <Text style={styles.zoneSectionLabel}>
                TIM ZONES ({routeVM.timHits.length})
              </Text>
              {routeVM.timHits.map((hit: TimHit) => {
                const s = TIM_CATEGORY_STYLE[hit.category];
                const validFrom = formatDate(hit.validFrom);
                const validUntil = formatDate(hit.validUntil);
                return (
                  <View key={hit.timId} style={[styles.timDetailCard, { borderLeftColor: s.color }]}>
                    <View style={styles.timDetailHeader}>
                      <View style={styles.timCategoryPill}>
                        <Ionicons name={s.icon} size={11} color={s.color} />
                        <Text style={[styles.timCategoryLabel, { color: s.color }]}>
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
                        <Ionicons name="time-outline" size={11} color={ROUTE_COLORS.steel} />
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
                PRIORITY ZONES ({routeVM.preemptionHits.length})
              </Text>
              <Text style={styles.preemptSectionNote}>
                These intersections are configured for signal priority.
              </Text>
              {routeVM.preemptionHits.map((hit: PreemptionHit) => (
                <View key={hit.zoneId} style={[styles.timDetailCard, { borderLeftColor: ROUTE_COLORS.preempt }]}>
                  <View style={styles.timCategoryPill}>
                    <Ionicons name="flash" size={11} color={ROUTE_COLORS.preempt} />
                    <Text style={[styles.timCategoryLabel, { color: ROUTE_COLORS.preempt }]}>
                      SIGNAL PRIORITY
                    </Text>
                  </View>
                  <Text style={styles.timTypeLabel}>{hit.zoneName}</Text>
                </View>
              ))}
            </View>
          )}

          {routeVM.timHits.length === 0 && routeVM.preemptionHits.length === 0 && (
            <View style={styles.timClearRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color={ROUTE_COLORS.signal} />
              <Text style={styles.timClearText}>No TIM or priority zones on this route</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.startNavBtn}
          onPress={() => routeVM.startNavigation()}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate" size={16} color={ROUTE_COLORS.white} />
          <Text style={styles.startNavBtnText}>START NAVIGATION</Text>
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
    backgroundColor: ROUTE_COLORS.panel,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderTopWidth: 2,
    borderTopColor: ROUTE_COLORS.amber,
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 3000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  grabber:         { width: 36, height: 3, backgroundColor: ROUTE_COLORS.hairline, alignSelf: 'center', marginBottom: 10 },
  header:          { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  headerTextCol:   { flex: 1, marginRight: 12, gap: 4 },
  destLabel:       { fontFamily: ROUTE_FONTS.displayExtraBold, fontSize: 15, color: ROUTE_COLORS.ink },
  reroutingBadge:  { backgroundColor: ROUTE_COLORS.amberDim, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: ROUTE_COLORS.amber, alignSelf: 'flex-start' },
  reroutingText:   { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 9, color: ROUTE_COLORS.amberText, letterSpacing: 0.8 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  etaLabel:        { fontFamily: ROUTE_FONTS.mono, fontSize: 10, color: ROUTE_COLORS.steel, letterSpacing: 0.5 },
  etaValue:        { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 24, color: '#FF8C00', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  statsDivider:    { width: 1, height: 32, backgroundColor: ROUTE_COLORS.hairline },
  durationValue:   { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 16, color: ROUTE_COLORS.ink, fontVariant: ['tabular-nums'] },
  distanceValue:   { fontFamily: ROUTE_FONTS.mono, fontSize: 13, color: ROUTE_COLORS.steel },
  optionsRow:      { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  optionChip: {
    borderRadius: 3,
    borderWidth: 1,
    borderColor: ROUTE_COLORS.hairline,
    backgroundColor: ROUTE_COLORS.panelRaised,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
  },
  optionChipSelected: {
    borderColor: ROUTE_COLORS.amber,
    backgroundColor: ROUTE_COLORS.amberDim,
  },
  optionChipDuration: { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 13, color: ROUTE_COLORS.ink },
  optionChipDistance: { fontFamily: ROUTE_FONTS.mono, fontSize: 11, color: ROUTE_COLORS.steel },
  optionChipTextSelected: { color: ROUTE_COLORS.amberText },
  zoneSection:     { marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: ROUTE_COLORS.hairline },
  zoneSectionLabel:{ fontFamily: ROUTE_FONTS.displaySemiBold, fontSize: 9, color: ROUTE_COLORS.steel, letterSpacing: 1, marginBottom: 6 },
  preemptSectionNote: { fontFamily: ROUTE_FONTS.body, fontSize: 12, color: ROUTE_COLORS.steel, lineHeight: 17, marginBottom: 2 },
  timClearRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10 },
  timClearText:    { fontFamily: ROUTE_FONTS.mono, fontSize: 12, color: ROUTE_COLORS.signal },
  timDetailCard: {
    backgroundColor: ROUTE_COLORS.panelRaised,
    borderLeftWidth: 3,
    borderRadius: 2,
    padding: 10,
    marginTop: 8,
    gap: 5,
  },
  timDetailHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timCategoryPill:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timCategoryLabel: { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 9, letterSpacing: 0.8 },
  timTypeLabel:     { fontFamily: ROUTE_FONTS.bodySemiBold, fontSize: 13, color: ROUTE_COLORS.ink },
  timDescription:   { fontFamily: ROUTE_FONTS.body, fontSize: 12, color: ROUTE_COLORS.steel, lineHeight: 17 },
  timMetaRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timMetaKey:       { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 10, color: ROUTE_COLORS.steel, letterSpacing: 0.5 },
  timMetaValue:     { fontFamily: ROUTE_FONTS.mono, fontSize: 11, color: ROUTE_COLORS.steel },
  startNavBtn: {
    marginTop: 12,
    backgroundColor: ROUTE_COLORS.amber,
    borderRadius: 3,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startNavBtnText: { fontFamily: ROUTE_FONTS.displayExtraBold, fontSize: 14, color: ROUTE_COLORS.white, letterSpacing: 0.6 },
});

export default RoutePreviewSheet;
