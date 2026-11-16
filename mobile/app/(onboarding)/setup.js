import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { ErrorState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';
import { registerPushNotificationsAsync } from '../../src/services/notifications';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function OnboardingSetupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const { updateUser } = useAuthStore();

  const [installationIdInput, setInstallationIdInput] = useState('');
  const [renderApiKey, setRenderApiKey] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pushStatus, setPushStatus] = useState('not_requested');

  const { data: overview, refetch } = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: () => apiRequest('/integrations/overview'),
  });

  const handleOpenGithubAppInstall = async () => {
    setErrorMsg(null);
    setBusyAction('install');
    try {
      const { installUrl } = await apiRequest('/integrations/github/install-url', { method: 'POST' });
      await WebBrowser.openBrowserAsync(installUrl);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleVerifyInstallation = async () => {
    if (!installationIdInput.trim()) {
      setErrorMsg('Enter the GitHub App Installation ID returned after installing on GitHub.');
      return;
    }
    setErrorMsg(null);
    setBusyAction('verify');
    try {
      await apiRequest('/integrations/github/installations/verify', {
        method: 'POST',
        body: { installationId: Number(installationIdInput.trim()) },
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleConnectRender = async () => {
    if (!renderApiKey.trim()) {
      setErrorMsg('Enter your Render API Key (stored encrypted at rest on the backend).');
      return;
    }
    setErrorMsg(null);
    setBusyAction('render');
    try {
      await apiRequest('/integrations/render/connect', {
        method: 'POST',
        body: { apiKey: renderApiKey.trim() },
      });
      setRenderApiKey('');
      await refetch();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleEnableNotifications = async () => {
    setBusyAction('push');
    try {
      const res = await registerPushNotificationsAsync();
      setPushStatus(res.status);
    } catch {
      setPushStatus('error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleComplete = async () => {
    setBusyAction('complete');
    try {
      await apiRequest('/auth/me/onboarding', { method: 'PATCH' });
      updateUser({ onboardingCompleted: true });
      router.replace('/(tabs)');
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusyAction(null);
    }
  };

  const hasInstall = (overview?.githubInstallations || []).some((i) => i.status === 'verified');
  const hasRender = Boolean(overview?.render?.connected);

  return (
    <ScreenContainer>
      <ModuleHeader
        code="ON"
        title="Connect Your Operations"
        subtitle="Authorize GitHub App repositories, connect Render, and enable incident alerts."
      />

      {errorMsg ? <ErrorState title="Connection Setup Notice" message={errorMsg} /> : null}

      <SignalBanner>
        <View style={styles.rowBetween}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Setup Progress</Text>
          <StatusBadge
            status={hasInstall && hasRender ? 'verified' : 'pending'}
            label={`${(hasInstall ? 1 : 0) + (hasRender ? 1 : 0)} / 2 Connected`}
          />
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
          You can complete both connections now or skip ahead and configure them later in Settings.
        </Text>
      </SignalBanner>

      {/* ON-06 / ON-07 / ON-08: GitHub App */}
      <SignalCard>
        <View style={styles.rowBetween}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>1. GitHub App & Repos</Text>
          <StatusBadge
            status={hasInstall ? 'verified' : 'unlinked'}
            label={hasInstall ? `${overview?.authorizedRepositoryCount || 0} Repos` : 'Unlinked'}
          />
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
          Install the PocketOps GitHub App and verify ownership before any repository becomes editable.
        </Text>
        <SecondaryButton
          label="Open GitHub App Installer"
          onPress={handleOpenGithubAppInstall}
          style={{ marginTop: 12 }}
        />
        <TextInput
          value={installationIdInput}
          onChangeText={setInstallationIdInput}
          placeholder="Installation ID (e.g. 58102934)"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              borderRadius: radii.button,
            },
          ]}
        />
        <PrimaryButton
          label="Verify Installation & Sync Repos"
          loading={busyAction === 'verify'}
          onPress={handleVerifyInstallation}
          style={{ marginTop: 10 }}
        />
      </SignalCard>

      {/* ON-09: Render Connection */}
      <SignalCard>
        <View style={styles.rowBetween}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>2. Render Account</Text>
          <StatusBadge
            status={hasRender ? 'verified' : 'unlinked'}
            label={hasRender ? 'Connected' : 'Optional'}
          />
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
          Your Render API key is encrypted with AES-256-GCM on the server and never persisted on your device.
        </Text>
        <TextInput
          value={renderApiKey}
          onChangeText={setRenderApiKey}
          placeholder="rnd_..."
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surfaceSubtle,
              borderColor: colors.border,
              borderRadius: radii.button,
            },
          ]}
        />
        <PrimaryButton
          label="Verify & Connect Render"
          loading={busyAction === 'render'}
          onPress={handleConnectRender}
          style={{ marginTop: 10 }}
        />
      </SignalCard>

      {/* AC-05: Notification Permission Explanation */}
      <SignalCard>
        <View style={styles.rowBetween}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>3. Production Alerts</Text>
          <StatusBadge
            status={pushStatus === 'granted' ? 'verified' : 'info'}
            label={pushStatus === 'granted' ? 'Enabled' : 'Recommended'}
          />
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
          Receive high-priority Android notifications for P1 incidents, failed Render deployments, and health state changes.
        </Text>
        <SecondaryButton
          label="Enable Push Notifications"
          onPress={handleEnableNotifications}
          style={{ marginTop: 12 }}
        />
      </SignalCard>

      <PrimaryButton
        label="Continue to Operations Dashboard"
        loading={busyAction === 'complete'}
        onPress={handleComplete}
        style={{ marginTop: 8 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  input: {
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    marginTop: 12,
    fontSize: 15,
  },
});
