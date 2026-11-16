import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { RelayBrandMark } from '../../src/components/RelayBrandMark';
import { SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAppStore } from '../../src/store/useAppStore';
import { apiRequest } from '../../src/services/apiClient';

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const { user, signOutLocal } = useAuthStore();
  const {
    themePreference,
    setThemePreference,
    highContrast,
    setHighContrast,
    reducedMotion,
    setReducedMotion,
  } = useAppStore();

  const { data: overview } = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: () => apiRequest('/integrations/overview'),
  });

  const { data: prefsData } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => apiRequest('/ops/notifications/preferences'),
  });

  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => apiRequest('/auth/sessions'),
  });

  const { data: auditData } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiRequest('/ops/audit'),
  });

  const prefMutation = useMutation({
    mutationFn: (patch) => apiRequest('/ops/notifications/preferences', { method: 'PUT', body: patch }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId) => apiRequest(`/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => refetchSessions(),
  });

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless of network reachability
    }
    await signOutLocal();
    router.replace('/(auth)/welcome');
  };

  const prefs = prefsData?.preferences || {};

  return (
    <ScreenContainer>
      <ModuleHeader
        code="ST"
        title="Account & Settings"
        subtitle="Profile, connections, appearance, notifications, sessions, and audit history"
        showBack
      />

      {/* ST-01 Profile */}
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>
          {user?.displayName || user?.username || 'PocketOps Engineer'}
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          @{user?.username} · {user?.email || 'GitHub OAuth Verified'}
        </Text>
      </SignalCard>

      {/* ST-03..ST-07 Connections Overview */}
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>
          Integrations (ST-03)
        </Text>
        <View style={styles.rowBetween}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>GitHub OAuth</Text>
          <StatusBadge
            status={overview?.githubOAuth?.connected ? 'verified' : 'critical'}
            label={overview?.githubOAuth?.login || 'Disconnected'}
          />
        </View>
        <View style={[styles.rowBetween, { marginTop: 10 }]}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>GitHub App Repos</Text>
          <StatusBadge
            status={(overview?.authorizedRepositoryCount || 0) > 0 ? 'verified' : 'unlinked'}
            label={`${overview?.authorizedRepositoryCount || 0} Authorized`}
          />
        </View>
        <View style={[styles.rowBetween, { marginTop: 10 }]}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>Render Account</Text>
          <StatusBadge
            status={overview?.render?.connected ? 'verified' : 'unlinked'}
            label={overview?.render?.ownerName || 'Disconnected'}
          />
        </View>
        <SecondaryButton
          label="Manage GitHub App & Render Setup"
          onPress={() => router.push('/(onboarding)/setup')}
          style={{ marginTop: 12 }}
        />
      </SignalCard>

      {/* ST-09 Appearance & Accessibility (System Light/Dark + Toggle) */}
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>
          Appearance & Accessibility (ST-09)
        </Text>
        <View style={styles.themeRow}>
          {['system', 'light', 'dark'].map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setThemePreference(mode)}
              style={[
                styles.themeBtn,
                {
                  borderColor: themePreference === mode ? colors.primary : colors.border,
                  backgroundColor: themePreference === mode ? colors.bannerMuted : colors.surfaceSubtle,
                  borderRadius: radii.pill,
                },
              ]}
            >
              <Text style={[typography.bodyBold, { color: colors.textPrimary, textTransform: 'capitalize' }]}>
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.rowBetween, { marginTop: 12 }]}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>High-Contrast Borders</Text>
          <Switch value={highContrast} onValueChange={setHighContrast} />
        </View>
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={[typography.body, { color: colors.textPrimary }]}>Reduced Motion</Text>
          <Switch value={reducedMotion} onValueChange={setReducedMotion} />
        </View>
      </SignalCard>

      {/* ST-08 Notification Preferences */}
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 6 }]}>
          Notification Preferences (ST-08)
        </Text>
        {[
          { key: 'incidentAlerts', label: 'Critical Incident Alerts' },
          { key: 'deployFailures', label: 'Deployment Failures' },
          { key: 'healthAlerts', label: 'Health State Changes' },
          { key: 'recoveryAlerts', label: 'Recovery Confirmations' },
          { key: 'prCheckAlerts', label: 'PR & CI Check Alerts' },
        ].map((item) => (
          <View key={item.key} style={[styles.rowBetween, { marginTop: 8 }]}>
            <Text style={[typography.body, { color: colors.textPrimary }]}>{item.label}</Text>
            <Switch
              value={prefs[item.key] !== false}
              onValueChange={(val) => prefMutation.mutate({ [item.key]: val })}
            />
          </View>
        ))}
      </SignalCard>

      {/* ST-10 Active Sessions */}
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 6 }]}>
          Active Sessions (ST-10)
        </Text>
        {(sessionsData?.sessions || []).map((s) => (
          <View key={s.id} style={[styles.rowBetween, { marginTop: 8 }]}>
            <View>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                {s.deviceName || 'Mobile'} {s.current ? '(Current)' : ''}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {s.ipAddress || 'Unknown IP'}
              </Text>
            </View>
            {!s.current ? (
              <SecondaryButton
                label="Revoke"
                onPress={() => revokeSessionMutation.mutate(s.id)}
                style={{ minHeight: 40, paddingHorizontal: 12 }}
              />
            ) : null}
          </View>
        ))}
      </SignalCard>

      {/* ST-11 Audit History */}
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 6 }]}>
          Recent Audit History (ST-11)
        </Text>
        {(auditData?.auditLogs || []).slice(0, 6).map((a) => (
          <Text key={a.id} style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            {new Date(a.createdAt).toLocaleString()} · {a.action} ({a.outcome})
          </Text>
        ))}
      </SignalCard>

      {/* ST-12 About Relay & Sign Out */}
      <SignalCard>
        <RelayBrandMark size={44} variant={colors.mode === 'dark' ? 'dark' : 'light'} />
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 10 }]}>
          PocketOps Relay · Mobile-first Developer Operations Platform (v1.0.0)
        </Text>
        <PrimaryButton label="Sign Out" tone="danger" onPress={handleLogout} style={{ marginTop: 14 }} />
      </SignalCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  themeBtn: { flex: 1, minHeight: 48, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
