import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import { TimService, TimAlertLogItem } from '../../TIM/services/TimService';
import { ROUTE_COLORS, ROUTE_FONTS, TIM_CATEGORY_STYLE } from '../appTheme';
import { formatTimType, formatDate } from '../utils/timFormatting';
import { SeverityDots } from '../components/SeverityDots';
import { closeRing, normalizeToLngLat, type LngLat } from '../../../core/maps/coordinates';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// TIM zone map — shows all unique zones from the alert log
// ---------------------------------------------------------------------------

interface AlertMapProps {
  log: TimAlertLogItem[];
}

const AlertMap: React.FC<AlertMapProps> = ({ log }) => {
  // Deduplicate by timId, keep most recent per zone
  const seen = new Set<number>();
  const unique = log.filter(item => {
    if (seen.has(item.timId)) return false;
    seen.add(item.timId);
    return true;
  });

  if (unique.length === 0) return null;

  // Compute camera bounds from all zone geometries
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const item of unique) {
    for (const ring of item.geometry.coordinates) {
      for (const coord of ring) {
        const [lng, lat] = normalizeToLngLat(coord as [number, number]);
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const validBounds = isFinite(minLng) && isFinite(maxLng);
  const PAD = 0.0008;

  return (
    <View style={styles.mapContainer}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Street}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        {validBounds ? (
          <MapboxGL.Camera
            bounds={{
              ne: [maxLng + PAD, maxLat + PAD],
              sw: [minLng - PAD, minLat - PAD],
              paddingTop: 16,
              paddingBottom: 16,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          />
        ) : (
          <MapboxGL.Camera
            defaultSettings={{ centerCoordinate: [-85.3099, 35.0456], zoomLevel: 15 }}
          />
        )}

        {unique.map(item => {
          const cfg = TIM_CATEGORY_STYLE[item.category];
          const rawOuter = item.geometry.coordinates[0] as [number, number][];
          const outerCoords = rawOuter.map(normalizeToLngLat);
          if (outerCoords.length < 3) return null;
          const ring = closeRing(outerCoords);

          const shape: GeoJSON.Feature<GeoJSON.Polygon> = {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          };

          return (
            <MapboxGL.ShapeSource key={`alert-zone-${item.timId}`} id={`alert-zone-${item.timId}`} shape={shape}>
              <MapboxGL.FillLayer
                id={`alert-fill-${item.timId}`}
                style={{ fillColor: cfg.dimColor }}
              />
              <MapboxGL.LineLayer
                id={`alert-line-${item.timId}`}
                style={{ lineColor: cfg.color, lineWidth: 2.5 }}
              />
            </MapboxGL.ShapeSource>
          );
        })}
      </MapboxGL.MapView>
      <View style={styles.mapLabel}>
        <Ionicons name="map-outline" size={11} color={ROUTE_COLORS.steel} />
        <Text style={styles.mapLabelText}>TIM zones triggered this session</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Alert detail card
// ---------------------------------------------------------------------------

const AlertCard: React.FC<{ item: TimAlertLogItem }> = ({ item }) => {
  const cfg = TIM_CATEGORY_STYLE[item.category];
  const validFrom = formatDate(item.validFrom);
  const validUntil = formatDate(item.validUntil);

  return (
    <View style={[styles.card, { borderLeftColor: cfg.color }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.categoryPill}>
            <Ionicons name={cfg.icon} size={11} color={cfg.color} />
            <Text style={[styles.categoryLabel, { color: cfg.color }]}>
              {item.category.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
      </View>

      {/* Type + severity */}
      <Text style={styles.timType}>{formatTimType(item.timType)}</Text>
      <View style={styles.severityRow}>
        <SeverityDots value={item.severity} />
      </View>

      {/* Description */}
      {item.message !== null && (
        <Text style={styles.description}>{item.message}</Text>
      )}

      {/* ITIS codes */}
      {item.itisCodes.length > 0 && (
        <View style={styles.metaRow}>
          <Text style={styles.metaKey}>ITIS</Text>
          <Text style={styles.metaValue}>{item.itisCodes.join(', ')}</Text>
        </View>
      )}

      {/* Validity window */}
      {(validFrom || validUntil) && (
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={11} color={ROUTE_COLORS.steel} />
          <Text style={styles.metaValue}>
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
};

// ---------------------------------------------------------------------------
// AlertsScreen
// ---------------------------------------------------------------------------

interface AlertsScreenProps {
  timService: TimService;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = observer(({ timService }) => {
  React.useEffect(() => {
    timService.clearUnreadCount();
  }, []);

  const insets = useSafeAreaInsets();
  const log = timService.alertLog;

  return (
    <View style={styles.container}>
      {/* paddingTop adds insets.top on top of the base padding so the title
          clears the status bar / camera cutout instead of rendering under it
          — the screen isn't wrapped in a SafeAreaView, and the app's status
          bar is translucent (see AppNavigator), so nothing else accounts
          for it here. */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerAccent} />
        <View>
          <Text style={styles.headerTitle}>ALERT LOG</Text>
          <Text style={styles.headerSub}>
            {log.length === 0
              ? 'No alerts this session'
              : `${log.length} event${log.length !== 1 ? 's' : ''} this session`}
          </Text>
        </View>
      </View>

      {log.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={40} color={ROUTE_COLORS.amberText} />
          </View>
          <Text style={styles.emptyTitle}>ALL CLEAR</Text>
          <Text style={styles.emptySub}>
            No TIM alerts have fired this session.{'\n'}
            Alerts appear here when you approach active zones.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AlertMap log={log} />

          <View style={styles.legendRow}>
            {(['safety', 'regulatory', 'informational'] as const).map(category => (
              <View key={category} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TIM_CATEGORY_STYLE[category].color }]} />
                <Text style={styles.legendText}>{category.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          {log.map(item => (
            <AlertCard key={item.id} item={item} />
          ))}

          <View style={styles.sessionMarker}>
            <View style={styles.sessionLine} />
            <Text style={styles.sessionLabel}>SESSION START</Text>
            <View style={styles.sessionLine} />
          </View>
        </ScrollView>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: ROUTE_COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: ROUTE_COLORS.panel,
    borderBottomWidth: 1,
    borderBottomColor: ROUTE_COLORS.amber,
  },
  headerAccent:    { width: 3, height: 32, backgroundColor: ROUTE_COLORS.amber },
  headerTitle:     { fontFamily: ROUTE_FONTS.displayBlack, fontSize: 22, color: ROUTE_COLORS.ink, letterSpacing: 1 },
  headerSub:       { fontFamily: ROUTE_FONTS.body, fontSize: 12, color: ROUTE_COLORS.steel, marginTop: 2 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingBottom: 32 },
  mapContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ROUTE_COLORS.hairline,
  },
  map:             { height: 210 },
  mapLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: ROUTE_COLORS.panel,
    borderTopWidth: 1,
    borderTopColor: ROUTE_COLORS.hairline,
  },
  mapLabelText:    { fontFamily: ROUTE_FONTS.mono, fontSize: 11, color: ROUTE_COLORS.steel },
  legendRow:       { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:       { width: 6, height: 6, borderRadius: 3 },
  legendText:      { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 10, color: ROUTE_COLORS.steel, letterSpacing: 0.5 },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: ROUTE_COLORS.panelRaised,
    borderRadius: 2,
    borderLeftWidth: 3,
    padding: 12,
    gap: 6,
  },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryPill:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryLabel:   { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 9, letterSpacing: 0.8 },
  timestamp:       { fontFamily: ROUTE_FONTS.mono, fontSize: 10, color: ROUTE_COLORS.steel },
  timType:         { fontFamily: ROUTE_FONTS.bodySemiBold, fontSize: 14, color: ROUTE_COLORS.ink },
  severityRow:     { flexDirection: 'row' },
  description:     { fontFamily: ROUTE_FONTS.body, fontSize: 13, color: ROUTE_COLORS.steel, lineHeight: 18 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaKey:         { fontFamily: ROUTE_FONTS.monoSemiBold, fontSize: 10, color: ROUTE_COLORS.steel, letterSpacing: 0.5 },
  metaValue:       { fontFamily: ROUTE_FONTS.mono, fontSize: 11, color: ROUTE_COLORS.steel },
  sessionMarker:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 20, gap: 10 },
  sessionLine:     { flex: 1, height: 1, backgroundColor: ROUTE_COLORS.hairline },
  sessionLabel:    { fontFamily: ROUTE_FONTS.mono, fontSize: 9, color: ROUTE_COLORS.steel, letterSpacing: 1.5 },
  emptyState:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: ROUTE_COLORS.amberDim, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:      { fontFamily: ROUTE_FONTS.displayBlack, fontSize: 20, color: ROUTE_COLORS.ink, letterSpacing: 1 },
  emptySub:        { fontFamily: ROUTE_FONTS.body, fontSize: 13, color: ROUTE_COLORS.steel, textAlign: 'center', lineHeight: 20 },
});

export default AlertsScreen;
