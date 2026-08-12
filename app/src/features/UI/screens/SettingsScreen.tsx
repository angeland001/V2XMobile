import React from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { observer } from 'mobx-react-lite';
import { ROUTE_COLORS, ROUTE_FONTS } from '../appTheme';
import { API_CONFIG } from '../../../core/api/config';
import { SettingsViewModel, PreemptionZoneDisplayMode } from '../viewmodels/SettingsViewModel';

interface ToggleRowProps {
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, sublabel, value, onToggle, icon }) => (
  <View style={styles.toggleRow}>
    <View style={[styles.rowIcon, { backgroundColor: value ? ROUTE_COLORS.amberDim : ROUTE_COLORS.panelRaised }]}>
      <Ionicons name={icon} size={17} color={value ? ROUTE_COLORS.amberText : ROUTE_COLORS.steel} />
    </View>
    <View style={styles.toggleText}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {sublabel && <Text style={styles.toggleSub}>{sublabel}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: ROUTE_COLORS.steelDim, true: ROUTE_COLORS.amberBorder }}
      thumbColor={value ? ROUTE_COLORS.amber : ROUTE_COLORS.panel}
      ios_backgroundColor={ROUTE_COLORS.steelDim}
    />
  </View>
);

interface SegmentedRowProps<T extends string | number> {
  label: string;
  sublabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: T;
  segments: { value: T; label: string }[];
  onChange: (v: T) => void;
  dimmed?: boolean;
}

const ZONE_DISPLAY_SEGMENTS: { value: PreemptionZoneDisplayMode; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'icon', label: 'Icon' },
  { value: 'off', label: 'Off' },
];

const SDSM_RADIUS_SEGMENTS: { value: number; label: string }[] = [
  { value: 100, label: '100m' },
  { value: 250, label: '250m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
];

function SegmentedRow<T extends string | number>({
  label, sublabel, icon, value, segments, onChange, dimmed = false,
}: SegmentedRowProps<T>) {
  return (
    <View style={styles.segmentedRow}>
      <View style={styles.segmentedTop}>
        <View style={[styles.rowIcon, { backgroundColor: dimmed ? ROUTE_COLORS.panelRaised : ROUTE_COLORS.amberDim }]}>
          <Ionicons name={icon} size={17} color={dimmed ? ROUTE_COLORS.steel : ROUTE_COLORS.amberText} />
        </View>
        <View style={styles.toggleText}>
          <Text style={styles.toggleLabel}>{label}</Text>
          {sublabel && <Text style={styles.toggleSub}>{sublabel}</Text>}
        </View>
      </View>
      <View style={styles.segmentedControl}>
        {segments.map((segment) => {
          const selected = value === segment.value;
          return (
            <TouchableOpacity
              key={segment.value}
              style={[styles.segmentButton, selected && styles.segmentButtonActive]}
              onPress={() => onChange(segment.value)}
            >
              <Text style={[styles.segmentButtonText, selected && styles.segmentButtonTextActive]}>
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    <View style={[styles.rowIcon, { backgroundColor: ROUTE_COLORS.panelRaised }]}>
      <Ionicons name={icon} size={17} color={ROUTE_COLORS.steel} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
  </View>
);

interface SettingsScreenProps {
  settingsViewModel: SettingsViewModel;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = observer(({ settingsViewModel }) => {
  const insets = useSafeAreaInsets();
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
          <Text style={styles.headerTitle}>SETTINGS</Text>
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
            value={settingsViewModel.safetyAlerts}
            onToggle={(v) => { settingsViewModel.safetyAlerts = v; }}
          />
          <View style={styles.cardDivider} />
          <ToggleRow
            icon="construct-outline"
            label="Regulatory Alerts"
            sublabel="Speed zones, no-pass zones"
            value={settingsViewModel.regulatoryAlerts}
            onToggle={(v) => { settingsViewModel.regulatoryAlerts = v; }}
          />
          <View style={styles.cardDivider} />
          <ToggleRow
            icon="information-circle-outline"
            label="Informational Alerts"
            sublabel="Congestion, parking, detours"
            value={settingsViewModel.informationalAlerts}
            onToggle={(v) => { settingsViewModel.informationalAlerts = v; }}
          />
        </View>

        <Text style={styles.sectionLabel}>MAP</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="car-outline"
            label="Show V2X Vehicles"
            sublabel="Render SDSM vehicle markers"
            value={settingsViewModel.showVehicles}
            onToggle={(v) => { settingsViewModel.showVehicles = v; }}
          />
          <View style={styles.cardDivider} />
          <ToggleRow
            icon="git-branch-outline"
            label="Show Lane Data"
            sublabel="Overlay lane geometry on map"
            value={settingsViewModel.showLanes}
            onToggle={(v) => { settingsViewModel.showLanes = v; }}
          />
          <View style={styles.cardDivider} />
          <ToggleRow
            icon="flash-outline"
            label="Traffic Light Panel"
            sublabel="Light up with live signal color"
            value={settingsViewModel.trafficLightPanelEnabled}
            onToggle={(v) => { settingsViewModel.trafficLightPanelEnabled = v; }}
          />
          <View style={styles.cardDivider} />
          <SegmentedRow
            icon="flash-outline"
            label="Preemption Zones"
            sublabel="Full overlay, icon only, or hidden"
            value={settingsViewModel.preemptionZoneDisplay}
            segments={ZONE_DISPLAY_SEGMENTS}
            dimmed={settingsViewModel.preemptionZoneDisplay === 'off'}
            onChange={(v) => { settingsViewModel.preemptionZoneDisplay = v; }}
          />
          <View style={styles.cardDivider} />
          <SegmentedRow
            icon="radio-outline"
            label="SDSM Detection Radius"
            sublabel="Show vehicles & pedestrians within this range"
            value={settingsViewModel.sdsmDisplayRadiusM}
            segments={SDSM_RADIUS_SEGMENTS}
            onChange={(v) => { settingsViewModel.sdsmDisplayRadiusM = v; }}
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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ROUTE_COLORS.bg,
  },
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
  headerAccent: {
    width: 3,
    height: 32,
    backgroundColor: ROUTE_COLORS.amber,
  },
  headerTitle: {
    fontFamily: ROUTE_FONTS.displayBlack,
    fontSize: 22,
    color: ROUTE_COLORS.ink,
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: ROUTE_FONTS.body,
    fontSize: 12,
    color: ROUTE_COLORS.steel,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontFamily: ROUTE_FONTS.displaySemiBold,
    fontSize: 10,
    color: ROUTE_COLORS.steel,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: ROUTE_COLORS.panel,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ROUTE_COLORS.hairline,
    overflow: 'hidden',
  },
  cardDivider: {
    height: 1,
    backgroundColor: ROUTE_COLORS.hairline,
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
    fontFamily: ROUTE_FONTS.bodyMedium,
    fontSize: 14,
    color: ROUTE_COLORS.ink,
  },
  toggleSub: {
    fontFamily: ROUTE_FONTS.body,
    fontSize: 11,
    color: ROUTE_COLORS.steel,
  },
  segmentedRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  segmentedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: ROUTE_COLORS.panelRaised,
    borderRadius: 4,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 3,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: ROUTE_COLORS.amber,
  },
  segmentButtonText: {
    fontFamily: ROUTE_FONTS.bodySemiBold,
    fontSize: 12,
    color: ROUTE_COLORS.steel,
  },
  segmentButtonTextActive: {
    color: ROUTE_COLORS.ink,
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
    fontFamily: ROUTE_FONTS.body,
    fontSize: 14,
    color: ROUTE_COLORS.ink,
  },
  infoValue: {
    fontFamily: ROUTE_FONTS.mono,
    fontSize: 12,
    color: ROUTE_COLORS.steel,
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
    backgroundColor: ROUTE_COLORS.amber,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  footerBadgeText: {
    fontFamily: ROUTE_FONTS.displayExtraBold,
    fontSize: 11,
    color: ROUTE_COLORS.ink,
    letterSpacing: 1,
  },
  footerText: {
    flex: 1,
    fontFamily: ROUTE_FONTS.body,
    fontSize: 11,
    color: ROUTE_COLORS.steel,
    lineHeight: 16,
  },
});

export default SettingsScreen;
