import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TAB_BAR_HEIGHT } from '../theme';

const HOURLY = [
  { time: 'Now',  temp: 74, icon: 'partly-sunny' as const, wind: 8  },
  { time: '1 PM', temp: 76, icon: 'sunny' as const,         wind: 9  },
  { time: '2 PM', temp: 77, icon: 'sunny' as const,         wind: 10 },
  { time: '3 PM', temp: 75, icon: 'cloudy' as const,        wind: 12 },
  { time: '4 PM', temp: 71, icon: 'rainy' as const,         wind: 14 },
  { time: '5 PM', temp: 68, icon: 'rainy' as const,         wind: 15 },
];

const ROAD_CONDITIONS = [
  { label: 'Road Surface',     value: 'Dry',     status: 'good'    },
  { label: 'Visibility',       value: '10+ mi',  status: 'good'    },
  { label: 'Wind Advisory',    value: 'None',    status: 'good'    },
  { label: 'Hydroplane Risk',  value: 'Low',     status: 'good'    },
];

const STATUS_COLORS = {
  good:    COLORS.green,
  caution: COLORS.amber,
  danger:  COLORS.red,
};

export const WeatherScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weather</Text>
        <Text style={styles.headerSub}>Chattanooga, TN · Updated just now</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero current conditions */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroTemp}>74°</Text>
            <Text style={styles.heroFeel}>Feels like 71°</Text>
            <Text style={styles.heroDesc}>Partly Cloudy</Text>
          </View>
          <View style={styles.heroRight}>
            <Ionicons name="partly-sunny" size={72} color={COLORS.amber} />
          </View>
        </View>

        <View style={styles.quickStats}>
          {[
            { icon: 'water-outline' as const,   label: 'Humidity', value: '58%' },
            { icon: 'speedometer-outline' as const, label: 'Wind',  value: '8 mph' },
            { icon: 'eye-outline' as const,      label: 'Visibility', value: '10 mi' },
            { icon: 'umbrella-outline' as const, label: 'Precip',  value: '5%' },
          ].map((s) => (
            <View key={s.label} style={styles.quickStat}>
              <Ionicons name={s.icon} size={18} color={COLORS.textSecondary} />
              <Text style={styles.quickStatValue}>{s.value}</Text>
              <Text style={styles.quickStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Hourly */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOURLY FORECAST</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyRow}>
            {HOURLY.map((h) => (
              <View key={h.time} style={styles.hourlyCard}>
                <Text style={styles.hourlyTime}>{h.time}</Text>
                <Ionicons name={h.icon} size={22} color={COLORS.amber} />
                <Text style={styles.hourlyTemp}>{h.temp}°</Text>
                <Text style={styles.hourlyWind}>{h.wind} mph</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Road conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ROAD CONDITIONS</Text>
          <View style={styles.conditionsCard}>
            {ROAD_CONDITIONS.map((c, i) => (
              <View key={c.label} style={[styles.conditionRow, i < ROAD_CONDITIONS.length - 1 && styles.conditionDivider]}>
                <Text style={styles.conditionLabel}>{c.label}</Text>
                <View style={styles.conditionRight}>
                  <View style={[styles.conditionDot, { backgroundColor: STATUS_COLORS[c.status as keyof typeof STATUS_COLORS] }]} />
                  <Text style={[styles.conditionValue, { color: STATUS_COLORS[c.status as keyof typeof STATUS_COLORS] }]}>{c.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.apiNote}>
          <Ionicons name="construct-outline" size={13} color={COLORS.textDim} />
          <Text style={styles.apiNoteText}>Live weather data integration coming soon.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  heroLeft: { gap: 4 },
  heroRight: { opacity: 0.85 },
  heroTemp: { fontSize: 64, fontWeight: '200', color: COLORS.textPrimary, lineHeight: 68 },
  heroFeel: { fontSize: 13, color: COLORS.textSecondary },
  heroDesc: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary, marginTop: 4 },
  quickStats: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  quickStatValue: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  quickStatLabel: { fontSize: 10, color: COLORS.textSecondary, letterSpacing: 0.3 },
  section: { paddingTop: 20, paddingHorizontal: 16 },
  sectionLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  hourlyRow: { gap: 8, paddingRight: 4 },
  hourlyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    minWidth: 68,
  },
  hourlyTime: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  hourlyTemp: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  hourlyWind: { fontSize: 9, color: COLORS.textDim },
  conditionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  conditionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  conditionDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  conditionLabel: { fontSize: 14, color: COLORS.textPrimary },
  conditionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conditionDot: { width: 7, height: 7, borderRadius: 4 },
  conditionValue: { fontSize: 14, fontWeight: '600' },
  apiNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  apiNoteText: { fontSize: 11, color: COLORS.textDim },
});

export default WeatherScreen;
