import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

export type TabName = 'Home' | 'Route' | 'Traffic' | 'Alerts' | 'Weather' | 'Settings';

interface TabConfig {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabConfig[] = [
  { name: 'Home',     icon: 'map-outline',              iconActive: 'map' },
  { name: 'Route',    icon: 'navigate-outline',          iconActive: 'navigate' },
  { name: 'Traffic',  icon: 'car-outline',               iconActive: 'car' },
  { name: 'Alerts',   icon: 'notifications-outline',     iconActive: 'notifications' },
  { name: 'Weather',  icon: 'partly-sunny-outline',      iconActive: 'partly-sunny' },
  { name: 'Settings', icon: 'settings-outline',          iconActive: 'settings' },
];

interface BottomTabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
  alertCount?: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabPress,
  alertCount = 0,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.divider} />
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.65}
            >
              <View style={styles.iconArea}>
                {isActive && <View style={styles.activePill} />}
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={21}
                  color={isActive ? COLORS.orange : COLORS.textDim}
                />
                {tab.name === 'Alerts' && alertCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {alertCount > 9 ? '9+' : String(alertCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    zIndex: 1000,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  tabs: {
    flexDirection: 'row',
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  iconArea: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.orange,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
  label: {
    fontSize: 9.5,
    fontWeight: '500',
    letterSpacing: 0.3,
    color: COLORS.textDim,
  },
  labelActive: {
    color: COLORS.orange,
    fontWeight: '600',
  },
});
