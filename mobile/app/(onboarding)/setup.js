import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard, SignalIntro } from '../../src/components/SignalCard';
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
  const { user, updateUser } = useAuthStore();

  const [installationIdInput, setInstallationIdInput] = useState('');
  const [renderApiKey, setRenderApiKey] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [pushStatus, setPushStatus] = useState('not_requested');
  const steps = ['account', 'github', 'verification', 'repositories', 'render', 'alerts', 'complete'];
  const [step, setStep] = useState('account');

  const { data: overview, refetch, error: overviewError, isLoading: overviewLoading } = useQuery({
    queryKey: ['integrations-overview'],
    queryFn: () => apiRequest('/integrations/overview'),
  });
  const repositories = useQuery({ queryKey: ['repositories'], queryFn: () => apiRequest('/repositories'), enabled: step === 'repositories' });

  const handleOpenGithubAppInstall = async () => {
    setErrorMsg(null);
    setBusyAction('install');
    try {
      const { installUrl, state } = await apiRequest('/integrations/github/install-url', { method: 'POST' });
      const result = await WebBrowser.openAuthSessionAsync(installUrl, 'pocketops://github/install');
      if (result.type === 'success' && result.url) {
        const params = Linking.parse(result.url).queryParams || {};
        if (params.state !== state || !/^\d+$/.test(String(params.installation_id || ''))) {
          throw new Error('The installation response could not be verified. Please try again.');
        }
        setInstallationIdInput(String(params.installation_id));
        setStep('verification');
        setBusyAction('verify');
        await verifyInstallation(String(params.installation_id), state);
      } else {
        setStep('verification');
        setErrorMsg('The GitHub installation window was closed. Retry the installation or enter an installation ID below.');
      }
    } catch (e) {
      setStep('verification');
      setErrorMsg(e.message);
    } finally {
      setBusyAction(null);
    }
  };

  const verifyInstallation = async (installationId, state) => {
    await apiRequest('/integrations/github/installations/verify', {
      method: 'POST',
      body: { installationId: Number(installationId), ...(state ? { state } : {}) },
    });
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    setStep('repositories');
  };

  const handleSyncRepositories = async () => {
    setBusyAction('sync');
    setErrorMsg(null);
    try {
      const installations = (overview?.githubInstallations || []).filter((item) => item.status === 'verified');
      if (!installations.length) throw new Error('Verify a GitHub App installation first.');
      for (const item of installations) await apiRequest(`/integrations/github/installations/${item.id}/sync`, { method: 'POST' });
      await Promise.all([refetch(), repositories.refetch()]);
    } catch (e) { setErrorMsg(e.message); } finally { setBusyAction(null); }
  };

  const handleVerifyInstallation = async () => {
    if (!/^\d+$/.test(installationIdInput.trim())) {
      setErrorMsg('Enter a valid numeric GitHub App installation ID.');
      return;
    }
    setErrorMsg(null);
    setBusyAction('verify');
    try {
      await verifyInstallation(installationIdInput.trim());
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
        title={{ account: 'Account setup', github: 'Install GitHub App', verification: 'Verify installation', repositories: 'Repository access', render: 'Connect Render', alerts: 'Production alerts', complete: 'Setup complete' }[step]}
        subtitle={{ account: 'Your GitHub identity is connected.', github: 'Choose an account and repositories on GitHub.', verification: 'Verify the installation belongs to your account.', repositories: 'Review repositories authorized on GitHub.', render: 'Connect your services when you are ready.', alerts: 'Choose whether to receive operational notifications.', complete: 'Review your connections before continuing.' }[step]}
        showBack={Boolean(user?.onboardingCompleted)}
      />

      {errorMsg ? <ErrorState title="Connection Setup Notice" message={errorMsg} /> : null}
      {overviewLoading ? <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>Checking connections…</Text> : null}
      {overviewError ? <ErrorState title="Could not check connections" message={overviewError.message} onRetry={refetch} /> : null}

      <SignalIntro eyebrow="Setup" title={{ account: 'Your account', github: 'GitHub App installation', verification: 'Installation verification', repositories: 'Repository access', render: 'Render connection', alerts: 'Notifications', complete: 'Setup complete' }[step]} description={{ account: 'Confirm your GitHub identity and set up your workspace.', github: 'Choose the correct GitHub account and repository access.', verification: 'Verify ownership before syncing repositories.', repositories: 'Review the repositories your GitHub App can access.', render: 'Connect Render to see services and deployment information.', alerts: 'Choose whether to receive operational alerts.', complete: 'Review your connections and continue to your workspace.' }[step]} />

      <SignalBanner>
        <View style={styles.rowBetween}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Setup Progress</Text>
          <StatusBadge
            status={hasInstall && hasRender ? 'verified' : 'pending'}
            label={overview ? `${(hasInstall ? 1 : 0) + (hasRender ? 1 : 0)} / 2 Connected` : 'Status unavailable'}
          />
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
          Step {steps.indexOf(step) + 1} of {steps.length}. You can update connections later in Settings.
        </Text>
      </SignalBanner>

      {/* ON-06 / ON-07 / ON-08: GitHub App */}
      {step === 'account' ? <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{user?.displayName || user?.username || 'GitHub account'}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Signed in{user?.username ? ` as @${user.username}` : ''}. Repository access is configured separately.</Text>
      </SignalCard> : null}

      {step === 'github' ? <SignalCard>
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
          label={busyAction === 'install' ? 'Waiting for GitHub…' : 'Open GitHub App Installer'}
          disabled={Boolean(busyAction)}
          onPress={handleOpenGithubAppInstall}
          style={{ marginTop: 12 }}
        />
      </SignalCard> : null}

      {step === 'verification' ? <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Verify GitHub installation</Text>
        <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{busyAction === 'verify' ? 'Checking ownership and syncing repositories…' : 'If GitHub did not return to the app, enter the installation ID from GitHub and verify it here.'}</Text>
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
          disabled={Boolean(busyAction)}
          onPress={handleVerifyInstallation}
          style={{ marginTop: 10 }}
        />
      </SignalCard> : null}

      {step === 'repositories' ? <>
        <SignalCard>
          <View style={styles.rowBetween}><Text style={[typography.heading, { color: colors.textPrimary }]}>Authorized repositories</Text><StatusBadge status={hasInstall ? 'verified' : 'unlinked'} label={hasInstall ? 'Verified' : 'Not connected'} /></View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>GitHub controls which repositories PocketOps can access. Change the selection on GitHub, then sync here.</Text>
          {repositories.isLoading ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Loading repositories…</Text> : null}
          {repositories.error ? <ErrorState message={repositories.error.message} onRetry={repositories.refetch} /> : null}
          {repositories.isSuccess && !repositories.data?.repositories?.length ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>No authorized repositories found.</Text> : null}
          {(repositories.data?.repositories || []).map((repo) => <View key={repo.id} style={[styles.rowBetween, { marginTop: 12 }]}><Text style={[typography.body, { color: colors.textPrimary, flexShrink: 1 }]}>{repo.fullName}</Text><StatusBadge status="verified" label={repo.isPrivate ? 'Private' : 'Public'} /></View>)}
          <SecondaryButton label={busyAction === 'sync' ? 'Syncing…' : 'Sync repository access'} disabled={!hasInstall || Boolean(busyAction)} onPress={handleSyncRepositories} style={{ marginTop: 12 }} />
        </SignalCard>
      </> : null}

      {/* ON-09: Render Connection */}
      {step === 'render' ? <SignalCard>
        <View style={styles.rowBetween}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>2. Render Account</Text>
          <StatusBadge
            status={hasRender ? 'verified' : 'unlinked'}
            label={hasRender ? 'Connected' : 'Optional'}
          />
        </View>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
          Connect your Render account to view services, deployments and logs.
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
          disabled={Boolean(busyAction)}
          onPress={handleConnectRender}
          style={{ marginTop: 10 }}
        />
      </SignalCard> : null}

      {/* AC-05: Notification Permission Explanation */}
      {step === 'alerts' ? <SignalCard>
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
          disabled={Boolean(busyAction)}
          onPress={handleEnableNotifications}
          style={{ marginTop: 12 }}
        />
        {pushStatus !== 'not_requested' ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Notification status: {pushStatus.replace(/_/g, ' ')}</Text> : null}
      </SignalCard> : null}

      {step === 'complete' ? <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Your connections</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>GitHub: {hasInstall ? `${overview?.authorizedRepositoryCount || 0} repositories connected` : 'Not connected'}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Render: {hasRender ? 'Connected' : 'Not connected'}</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Notifications: {pushStatus === 'granted' ? 'Enabled' : 'Not enabled'}</Text>
      </SignalCard> : null}

      <PrimaryButton
        label={step === 'complete' ? 'Continue to dashboard' : step === 'account' ? 'Continue' : 'Continue or skip'}
        loading={busyAction === 'complete'}
        disabled={Boolean(busyAction)}
        onPress={() => { setErrorMsg(null); if (step === 'complete') handleComplete(); else setStep(steps[steps.indexOf(step) + 1]); }}
        style={{ marginTop: 8 }}
      />
      {step !== 'account' ? <SecondaryButton label="Back" disabled={Boolean(busyAction)} onPress={() => { setErrorMsg(null); setStep(steps[steps.indexOf(step) - 1]); }} style={{ marginTop: 8 }} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  input: {
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    marginTop: 12,
    fontSize: 15,
  },
});
