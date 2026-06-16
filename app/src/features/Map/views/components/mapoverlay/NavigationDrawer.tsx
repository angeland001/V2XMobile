import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const PANEL_WIDTH = 148;
const TAB_WIDTH = 22;
const HEIGHT = 46;

const NAV_ITEMS: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
  { icon: 'git-branch-outline',    label: 'Route',    route: 'route'    },
  { icon: 'notifications-outline', label: 'Alerts',   route: 'alerts'   },
  { icon: 'settings-outline',      label: 'Settings', route: 'settings' },
];

export const NavigationDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const navigation = useNavigation();

  const toggle = () => {
    Animated.spring(slideAnim, {
      toValue: isOpen ? -PANEL_WIDTH : 0,
      useNativeDriver: true,
      tension: 130,
      friction: 13,
    }).start();
    setIsOpen((prev) => !prev);
  };

  const handleNavigate = (route: string) => {
    toggle();
    navigation.navigate(route as never);
  };

  return (
    <View style={styles.anchor}>
      <Animated.View style={[styles.bar, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.panel}>
          {NAV_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.navItem}
              onPress={() => handleNavigate(item.route)}
              activeOpacity={0.75}
            >
              <Ionicons name={item.icon} size={16} color="#fff" />
              <Text style={styles.navLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.tab} onPress={toggle} activeOpacity={0.8}>
          <Ionicons
            name={isOpen ? 'chevron-back' : 'chevron-forward'}
            size={14}
            color="#fff"
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    top: 136,
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    height: HEIGHT,
  },
  panel: {
    width: PANEL_WIDTH,
    height: HEIGHT,
    backgroundColor: '#E87722',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  tab: {
    width: TAB_WIDTH,
    height: HEIGHT,
    backgroundColor: '#E87722',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
