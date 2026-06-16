import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { API_CONFIG } from '../../../core/api/config';

interface ToggleRowProps {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, sublabel, value, onToggle, icon }) => (
  <View style={styles.toggleRow}>
    <View style={[styles.rowIcon, { backgroundColor: value ? COLORS.orangeBg : COLORS.surface2 }]}>
      <Ionicons name={icon} size={17} color={value ? COLORS.orange : COLORS.textSecondary} />
    </View>
    <View style={styles.toggleText}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {sublabel && <Text style={styles.toggleSub}>{sublabel}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: COLORS.surface3, true: COLORS.orangeBgStrong }}
      thumbColor={value ? COLORS.orange : COLORS.textDim}
      ios_backgroundColor={COLORS.surface3}
    />
  </View>
);

interface InfoRowProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={[styles.rowIcon, { backgroundColor: COLORS.surface2 }]}>
      <Ionicons name={icon} size={17} color={COLORS.textSecondary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
  </View>
);

export const SettingsScreen: React.FC = () => {
  const [safetyAlerts, setSafetyAlerts]       = useState(true);
  const [regulatoryAlerts, setRegulatoryAlerts] = useState(true);
  const [showVehicles, setShowVehicles]         = useState(true);
  const [showLanes, setShowLanes]               = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerAccent} />
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>App configuration</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <Text style={styles.sectionLabel}>ALERTS</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="warning-outline"
            label="Safety Alerts"
            sublabel="Work zones, hazards"
            value={safetyAlerts}
            onToggle={setSafetyAlerts}
          />
          <View style={styles.cardDivider} />
          <ToggleRow
            icon="construct-outline"
            label="Regulatory Alerts"
            sublabel="Speed zones, no-pass zones"
            value={regulatoryAlerts}
            onToggle={setRegulatoryAlerts}
          />
        </View>

        <Text style={styles.sectionLabel}>MAP</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="car-outline"
            label="Show V2X Vehicles"
            sublabel="Render SDSM vehicle markers"
            value={showVehicles}
            onToggle={setShowVehicles}
          />
          <View style={styles.cardDivider} />
          <ToggleRow
            icon="git-branch-outline"
            label="Show Lane Data"
            sublabel="Overlay lane geometry on map"
            value={showLanes}
            onToggle={setShowLanes}
          />
        </View>

        <Text style={styles.sectionLabel}>CONNECTION</Text>
        <View style={styles.card}>
          <InfoRow icon="server-outline"    label="Dashboard API"    value={API_CONFIG.DASHBOARD_API_URL} />
          <View style={styles.cardDivider} />
          <InfoRow icon="timer-outline"     label="TIM Poll"         value="Every 15 seconds" />
          <View style={styles.cardDivider} />
          <InfoRow icon="radio-outline"     label="Buffer Radius"    value="0.5 miles" />
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <InfoRow icon="phone-portrait-outline" label="Version"   value="1.0.0" />
          <View style={styles.cardDivider} />
          <InfoRow icon="code-slash-outline"     label="Platform"  value="React Native + Expo" />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBadge}>
            <Text style={styles.footerBadgeText}>V2X</Text>
          </View>
          <Text style={styles.footerText}>
            Keep the app open while driving for continuous V2X monitoring.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 10,
    color: COLORS.orange,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 56,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 1,
  },
  toggleLabel: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  toggleSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  infoValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    maxWidth: '50%',
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 4,
  },
  footerBadge: {
    backgroundColor: COLORS.orange,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  footerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 1,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textDim,
    lineHeight: 16,
  },
});
