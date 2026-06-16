import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { observer } from 'mobx-react-lite';
import { Ionicons } from '@expo/vector-icons';
import { TimService, TimAlertLogItem } from '../../TIM/services/TimService';
import { COLORS } from '../theme';

interface AlertsScreenProps {
  timService: TimService;
}

const CATEGORY_CONFIG = {
  safety:        { color: COLORS.red,    bg: COLORS.redBg,    icon: 'warning' as const,              label: 'SAFETY'     },
  regulatory:    { color: COLORS.orange, bg: COLORS.orangeBg, icon: 'construct' as const,            label: 'REGULATORY' },
  informational: { color: COLORS.blue,   bg: COLORS.blueBg,   icon: 'information-circle' as const,  label: 'INFO'       },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const AlertRow: React.FC<{ item: TimAlertLogItem }> = ({ item }) => {
  const cfg = CATEGORY_CONFIG[item.category];
  return (
    <View style={[styles.row, { borderLeftColor: cfg.color }]}>
      <View style={[styles.iconWrap, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.categoryLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
      </View>
    </View>
  );
};

export const AlertsScreen: React.FC<AlertsScreenProps> = observer(({ timService }) => {
  useEffect(() => {
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
          <View style={styles.legendRow}>
            {Object.values(CATEGORY_CONFIG).map((cfg) => (
              <View key={cfg.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.legendText}>{cfg.label}</Text>
              </View>
            ))}
          </View>

          {log.map((item) => (
            <AlertRow key={item.id} item={item} />
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
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.textDim,
    fontFamily: 'monospace',
  },
  message: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  sessionMarker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 10,
  },
  sessionLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  sessionLabel: {
    fontSize: 9,
    color: COLORS.textDim,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.orangeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
