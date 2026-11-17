import React from 'react';
import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';
import { BottomNavigation } from '../../src/components/BottomNavigation';

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest('/ops/dashboard'),
    refetchInterval: 30000,
  });

  const unreadCount = dash?.unreadNotificationCount || 0;

  return (
    <Tabs
      tabBar={({ state, descriptors, navigation }) => <BottomNavigation items={state.routes.flatMap((route, index) => {
        const { options } = descriptors[route.key];
        if (route.name === 'services' || route.name === 'inbox' || options.tabBarItemStyle?.display === 'none') return [];
        const selected = state.index === index;
        const title = options.title || route.name;
        return [{
          key: route.key,
          title: route.name === 'activity' && unreadCount ? `${title} (${unreadCount})` : title,
          selected,
          accessibilityLabel: route.name === 'activity' && unreadCount ? `${title}, ${unreadCount} unread notifications` : title,
          onPress: () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          },
          onLongPress: () => navigation.emit({ type: 'tabLongPress', target: route.key }),
        }];
      })} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 48 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarItemStyle: { justifyContent: 'center', minHeight: 48 },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: 'Incidents',
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
        }}
      />
    </Tabs>
  );
}
