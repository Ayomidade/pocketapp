import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WelcomeContent } from '../../app/(auth)/welcome';
import { DashboardContent } from '../../app/(tabs)/index';
import { useTheme } from '../theme/ThemeProvider';
import { BottomNavigation } from '../components/BottomNavigation';

// Opt-in development preview: RootNavigator is not mounted, so no session or API is loaded.
const fixture = {
  activeIncidents: [{ id: 'preview', title: 'API production incident', severity: 'P1', status: 'investigating' }],
  services: [{ id: 'preview', name: 'API production', repoFullName: 'example/api-server', effectiveHealthStatus: 'unknown' }],
  recentDeployments: [],
  failedDeployments: [],
  integrationProblems: [],
};

export function DesignPreview() {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const dashboard = process.env.EXPO_PUBLIC_DESIGN_SCREEN === 'dashboard';
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    <View style={{ backgroundColor: colors.warningBg, paddingTop: insets.top, paddingHorizontal: 12 }}>
      <Text accessibilityRole="alert" style={[typography.caption, { color: colors.warning }]}>DESIGN PREVIEW · EXAMPLE DATA · ACTIONS DISABLED</Text>
    </View>
    {dashboard ? <DashboardContent data={fixture} dataUpdatedAt={0} preview refetch={() => {}} /> : <WelcomeContent onSignIn={() => {}} />}
    {dashboard ? <BottomNavigation items={['Home', 'Projects', 'Incidents', 'Activity', 'You'].map((title, index) => ({ key: title, title, selected: index === 0, onPress: () => {} }))} /> : null}
  </View>;
}
