import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@rnmapbox/maps';
import { TimService, TimAlertLogItem } from '../../TIM/services/TimService';
import { COLORS } from '../theme';
import { closeRing, normalizeToLngLat, type LngLat } from '../../../core/maps/coordinates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG = {
  safety:        { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',  icon: 'warning' as const,             label: 'SAFETY'     },
  regulatory:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: 'ban' as const,                 label: 'REGULATORY' },
  informational: { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', icon: 'information-circle' as const,  label: 'INFO'       },
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

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
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
          const cfg = CATEGORY_CONFIG[item.category];
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
                style={{ fillColor: cfg.bg }}
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
        <Ionicons name="map-outline" size={11} color={COLORS.textDim} />
        <Text style={styles.mapLabelText}>TIM zones triggered this session</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Alert detail card
// ---------------------------------------------------------------------------

const AlertCard: React.FC<{ item: TimAlertLogItem }> = ({ item }) => {
  const cfg = CATEGORY_CONFIG[item.category];
  const validFrom = formatDate(item.validFrom);
  const validUntil = formatDate(item.validUntil);

  return (
    <View style={[styles.card, { borderLeftColor: cfg.color }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={16} color={cfg.color} />
          </View>
          <View style={[styles.categoryPill, { borderColor: cfg.color }]}>
            <Text style={[styles.categoryLabel, { color: cfg.color }]}>{cfg.label}</Text>
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
          <Ionicons name="time-outline" size={11} color={COLORS.textDim} />
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

  const log = timService.alertLog;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerAccent} />
        <View>
          <Text style={styles.headerTitle}>Alert Log</Text>
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
            <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.orange} />
          </View>
          <Text style={styles.emptyTitle}>All Clear</Text>
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
            {Object.values(CATEGORY_CONFIG).map(cfg => (
              <View key={cfg.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.legendText}>{cfg.label}</Text>
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
  container:       { flex: 1, backgroundColor: COLORS.bg },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerAccent:    { width: 4, height: 36, borderRadius: 2, backgroundColor: COLORS.orange },
  headerTitle:     { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  headerSub:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  scroll:          { flex: 1 },
  scrollContent:   { paddingBottom: 32 },
  mapContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  map:             { height: 210 },
  mapLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  mapLabelText:    { fontSize: 11, color: COLORS.textDim },
  legendRow:       { flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:       { width: 6, height: 6, borderRadius: 3 },
  legendText:      { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconWrap:        { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  categoryPill:    { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  categoryLabel:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  timestamp:       { fontSize: 10, color: COLORS.textDim, fontFamily: 'monospace' },
  timType:         { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  severityRow:     { flexDirection: 'row' },
  description:     { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaKey:         { fontSize: 10, fontWeight: '700', color: COLORS.textDim, letterSpacing: 0.5 },
  metaValue:       { fontSize: 11, color: COLORS.textSecondary },
  sessionMarker:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 20, gap: 10 },
  sessionLine:     { flex: 1, height: 1, backgroundColor: COLORS.border },
  sessionLabel:    { fontSize: 9, color: COLORS.textDim, letterSpacing: 1.5, fontWeight: '600' },
  emptyState:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconWrap:   { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.orangeBg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:      { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  emptySub:        { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});

export default AlertsScreen;
