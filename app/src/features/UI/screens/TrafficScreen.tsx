import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { Ionicons } from '@expo/vector-icons';
import { TimService } from '../../TIM/services/TimService';
import { TimMessage } from '../../TIM/models/TimTypes';
import { COLORS, TAB_BAR_HEIGHT } from '../theme';

interface TrafficScreenProps {
  timService: TimService;
}

const CATEGORY_STYLE = {
  safety:        { color: COLORS.red,   bg: COLORS.redBg,   icon: 'warning' as const,      label: 'Safety' },
  regulatory:    { color: COLORS.amber, bg: COLORS.amberBg, icon: 'construct' as const,    label: 'Regulatory' },
  informational: { color: COLORS.blue,  bg: 'rgba(59,130,246,0.12)', icon: 'information-circle' as const, label: 'Info' },
};

const SEVERITY_LABELS: Record<number, string> = {
  1: 'LOW', 2: 'MODERATE', 3: 'HIGH', 4: 'CRITICAL',
};

const TimCard: React.FC<{ tim: TimMessage }> = ({ tim }) => {
  const cfg = CATEGORY_STYLE[tim.category];
  const severityLabel = SEVERITY_LABELS[tim.severity] ?? `SEV ${tim.severity}`;
  const severityColor = tim.severity >= 3 ? COLORS.red : tim.severity === 2 ? COLORS.amber : COLORS.textSecondary;

  return (
    <View style={[styles.card, { borderLeftColor: cfg.color }]}>
      <View style={styles.cardTop}>
        <View style={[styles.categoryChip, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={12} color={cfg.color} />
          <Text style={[styles.categoryText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={[styles.severityChip, { borderColor: severityColor }]}>
          <Text style={[styles.severityText, { color: severityColor }]}>{severityLabel}</Text>
        </View>
      </View>
      <Text style={styles.timType}>{tim.tim_type}</Text>
      {tim.description && (
        <Text style={styles.description}>{tim.description}</Text>
      )}
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>Zone #{tim.id}</Text>
        {tim.valid_until && (
          <Text style={styles.metaText}>
            Until {new Date(tim.valid_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </View>
    </View>
  );
};

export const TrafficScreen: React.FC<TrafficScreenProps> = observer(({ timService }) => {
  const tims = timService.activeTims;
  const safetyCt = tims.filter((t) => t.category === 'safety').length;
  const regulatoryCt = tims.filter((t) => t.category === 'regulatory').length;
  const infoCt = tims.filter((t) => t.category === 'informational').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Traffic</Text>
        <Text style={styles.headerSub}>Active TIM broadcast zones</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: COLORS.red }]}>
          <Text style={[styles.statCount, { color: COLORS.red }]}>{safetyCt}</Text>
          <Text style={styles.statLabel}>Safety</Text>
        </View>
        <View style={[styles.statCard, { borderColor: COLORS.amber }]}>
          <Text style={[styles.statCount, { color: COLORS.amber }]}>{regulatoryCt}</Text>
          <Text style={styles.statLabel}>Regulatory</Text>
        </View>
        <View style={[styles.statCard, { borderColor: COLORS.blue }]}>
          <Text style={[styles.statCount, { color: COLORS.blue }]}>{infoCt}</Text>
          <Text style={styles.statLabel}>Info</Text>
        </View>
      </View>

      {tims.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.textDim} />
          <Text style={styles.emptyTitle}>No Active Zones</Text>
          <Text style={styles.emptySub}>No TIM broadcasts are active in this area.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_HEIGHT + 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>
            {tims.length} ZONE{tims.length !== 1 ? 'S' : ''} ACTIVE
          </Text>
          {tims.map((tim) => (
            <TimCard key={tim.id} tim={tim} />
          ))}
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statCount: { fontSize: 26, fontWeight: '700', fontFamily: 'monospace' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', letterSpacing: 0.5 },
  sectionLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  categoryText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  severityChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  severityText: { fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  timType: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  description: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  metaText: { fontSize: 10, color: COLORS.textDim, fontFamily: 'monospace' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
});
