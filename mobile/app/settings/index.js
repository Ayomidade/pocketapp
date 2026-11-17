import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { RelayBrandMark } from '../../src/components/RelayBrandMark';
import { SignalCard, SignalIntro } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAppStore } from '../../src/store/useAppStore';
import { apiRequest } from '../../src/services/apiClient';

export default function SettingsScreen({ showBack = true }) {
  const router = useRouter();
  const [section, setSection] = useState('home');
  const queryClient = useQueryClient();
  const { colors, typography, radii, isDark } = useTheme();
  const { user, signOutLocal } = useAuthStore();
  const {
    themePreference,
    setThemePreference,
    highContrast,
    setHighContrast,
    reducedMotion,
    setReducedMotion,
  } = useAppStore();

  const { data: overview, error: overviewError, isLoading: overviewLoading, refetch: refetchOverview } = useQuery({
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

  const integrationMutation = useMutation({
    mutationFn: ({ path, method }) => apiRequest(path, { method }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-overview'] });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless of network reachability
    }
    await signOutLocal();
    queryClient.clear();
    router.replace('/(auth)/welcome');
  };

  const prefs = prefsData?.preferences || {};
  const sections = [
    ['connections', 'Connections', 'GitHub, repositories and Render'],
    ['notifications', 'Notifications', 'Alert preferences'],
    ['appearance', 'Appearance and accessibility', 'Theme and display'],
    ['sessions', 'Sessions', 'Devices signed in'],
    ['audit', 'Audit history', 'Recent account actions'],
    ['about', 'Help and about', 'About PocketOps and sign out'],
  ];
  const connectionTitles = { github: 'GitHub connection', installation: 'GitHub App installations', permissions: 'Repository access', render: 'Render connection' };
  const connectionSection = Boolean(connectionTitles[section]);

  return (
    <ScreenContainer>
      <ModuleHeader
        code="ST"
        title={section === 'home' ? 'Profile' : connectionTitles[section] || sections.find((item) => item[0] === section)?.[1]}
        showBack={section === 'home' && showBack}
      />
      {section !== 'home' ? <SecondaryButton label={connectionSection ? 'Back to connections' : 'Back to settings'} onPress={() => setSection(connectionSection ? 'connections' : 'home')} style={{ marginBottom: 16 }} /> : null}

      {/* ST-01 Profile */}
      {section === 'home' ? <>
      <SignalIntro eyebrow="Account" title="Profile" description="Your identity, connections, and account preferences." />
      <SignalCard>
        <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>GitHub identity</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6 }]}>
          {user?.displayName || user?.username || 'PocketOps Engineer'}
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          {user?.username ? `@${user.username}` : 'GitHub account'} · {user?.email || 'GitHub sign-in'}
        </Text>
      </SignalCard>
      {sections.map(([key, title, description]) => <SignalCard key={key} onPress={() => setSection(key)}><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{title}</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{description}</Text></SignalCard>)}
      </> : null}

      {/* ST-03..ST-07 Connections Overview */}
      {section === 'connections' && overview ?
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>
          Integrations
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
          onPress={() => router.push('/settings/connections')}
          style={{ marginTop: 12 }}
        />
        {Object.entries(connectionTitles).map(([key, title]) => <SecondaryButton key={key} label={title} onPress={() => setSection(key)} style={{ marginTop: 8 }} />)}
      </SignalCard> : null}

      {section === 'connections' && overviewLoading ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>Loading connection status…</Text></SignalCard> : null}
      {section === 'connections' && overviewError ? <SignalCard><Text style={[typography.body, { color: colors.critical }]}>{overviewError.message}</Text><SecondaryButton label="Retry" onPress={refetchOverview} style={{ marginTop: 8 }} /></SignalCard> : null}

      {connectionSection && overviewLoading ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>Loading connection details…</Text></SignalCard> : null}
      {connectionSection && overviewError ? <SignalCard><Text style={[typography.body, { color: colors.critical }]}>{overviewError.message}</Text><SecondaryButton label="Retry" onPress={refetchOverview} style={{ marginTop: 8 }} /></SignalCard> : null}
      {connectionSection && integrationMutation.error ? <SignalCard><Text style={[typography.body, { color: colors.critical }]}>{integrationMutation.error.message}</Text></SignalCard> : null}
      {section === 'github' && overview ? <SignalCard>
        <StatusBadge status={overview.githubOAuth?.connected ? 'verified' : 'unlinked'} label={overview.githubOAuth?.connected ? 'Connected' : 'Disconnected'} />
        <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 10 }]}>{overview.githubOAuth?.login || 'No GitHub account connected'}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Your GitHub sign-in identifies your account. Repository access is managed separately through the GitHub App.</Text>
        <SecondaryButton label="View installations" onPress={() => setSection('installation')} style={{ marginTop: 12 }} />
      </SignalCard> : null}
      {section === 'installation' && overview ? <>
        {(overview.githubInstallations || []).length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No GitHub App installations are connected.</Text></SignalCard> : null}
        {(overview.githubInstallations || []).map((item) => <SignalCard key={item.id}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>{item.accountLogin || 'GitHub account'}</Text>
          <View style={{ marginTop: 8 }}><StatusBadge status={item.status} /></View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Access: {item.repositorySelection || 'Unknown'} repositories</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>Last synced: {item.lastSyncedAt ? new Date(item.lastSyncedAt).toLocaleString() : 'Never'}</Text>
          {item.status === 'verified' ? <>
            <SecondaryButton label={integrationMutation.isPending ? 'Working…' : 'Sync repositories'} disabled={integrationMutation.isPending} onPress={() => integrationMutation.mutate({ path: `/integrations/github/installations/${item.id}/sync`, method: 'POST' })} style={{ marginTop: 10 }} />
            <SecondaryButton label="Remove connection" disabled={integrationMutation.isPending} onPress={() => Alert.alert('Remove connection?', 'PocketOps will lose access to repositories from this installation. This does not uninstall the GitHub App on GitHub.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => integrationMutation.mutate({ path: `/integrations/github/installations/${item.id}`, method: 'DELETE' }) }])} style={{ marginTop: 8 }} />
          </> : null}
        </SignalCard>)}
        <SecondaryButton label="Connect an installation" onPress={() => router.push('/settings/connections')} />
      </> : null}
      {section === 'permissions' && overview ? <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{overview.authorizedRepositoryCount || 0} authorized repositories</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Repository access is granted on GitHub. Sync an installation after changing its selection to update PocketOps.</Text>
        <SecondaryButton label="View repositories" onPress={() => router.push('/repositories')} style={{ marginTop: 12 }} />
        <SecondaryButton label="View installations" onPress={() => setSection('installation')} style={{ marginTop: 8 }} />
      </SignalCard> : null}
      {section === 'render' && overview ? <SignalCard>
        <StatusBadge status={overview.render?.connected ? 'verified' : 'unlinked'} label={overview.render?.connected ? 'Connected' : 'Disconnected'} />
        <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 10 }]}>{overview.render?.ownerName || overview.render?.ownerEmail || 'Render account'}</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Last verified: {overview.render?.lastVerifiedAt ? new Date(overview.render.lastVerifiedAt).toLocaleString() : 'Never'}</Text>
        <SecondaryButton label={overview.render?.connected ? 'Change connection' : 'Connect Render'} onPress={() => router.push('/settings/connections')} style={{ marginTop: 12 }} />
        {overview.render?.connected ? <SecondaryButton label="Disconnect Render" disabled={integrationMutation.isPending} onPress={() => Alert.alert('Disconnect Render?', 'PocketOps will no longer be able to access your Render account until you reconnect it.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => integrationMutation.mutate({ path: '/integrations/render', method: 'DELETE' }) }])} style={{ marginTop: 8 }} /> : null}
      </SignalCard> : null}

      {/* ST-09 Appearance & Accessibility (System Light/Dark + Toggle) */}
      {section === 'appearance' ?
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>
          Appearance & Accessibility
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
      </SignalCard> : null}

      {/* ST-08 Notification Preferences */}
      {section === 'notifications' ?
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 6 }]}>
          Notification Preferences
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
      </SignalCard> : null}

      {/* ST-10 Active Sessions */}
      {section === 'sessions' ?
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 6 }]}>
          Active Sessions
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
                onPress={() => Alert.alert('Revoke session?', `Sign out ${s.deviceName || 'this device'}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => revokeSessionMutation.mutate(s.id) }])}
                style={{ minHeight: 40, paddingHorizontal: 12 }}
              />
            ) : null}
          </View>
        ))}
      </SignalCard> : null}

      {/* ST-11 Audit History */}
      {section === 'audit' ?
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 6 }]}>
          Recent Audit History
        </Text>
        {(auditData?.auditLogs || []).map((a) => (
          <Text key={a.id} style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            {new Date(a.createdAt).toLocaleString()} · {a.action} ({a.outcome})
          </Text>
        ))}
      </SignalCard> : null}

      {/* ST-12 About Relay & Sign Out */}
      {section === 'about' ?
      <SignalCard>
        <RelayBrandMark size={44} variant={isDark ? 'dark' : 'light'} />
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 10 }]}>
          PocketOps Relay · Mobile-first Developer Operations Platform (v1.0.0)
        </Text>
        <PrimaryButton label="Sign Out" tone="danger" onPress={() => Alert.alert('Sign out?', 'You will need to sign in again to access your workspace.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: handleLogout }])} style={{ marginTop: 14 }} />
      </SignalCard> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  themeBtn: { flex: 1, minHeight: 48, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
