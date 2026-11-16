import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { RelayBrandMark } from '../../src/components/RelayBrandMark';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton } from '../../src/components/Buttons';
import { ErrorState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';
import { useAuthStore } from '../../src/store/useAuthStore';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, typography } = useTheme();
  const { setAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState('idle'); // 'idle' | 'oauth' | 'exchanging'
  const [errorMsg, setErrorMsg] = useState(null);

  const handleGitHubSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    setAuthStep('oauth');

    try {
      const redirectUri = Linking.createURL('auth/callback');
      const { authorizeUrl } = await apiRequest('/auth/github/start', {
        method: 'POST',
        skipAuth: true,
        body: { redirectUri, deviceName: 'PocketOps Mobile' },
      });

      const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUri);
      if (result.type !== 'success' || !result.url) {
        setAuthStep('idle');
        setLoading(false);
        setErrorMsg('GitHub sign-in was canceled before completion.');
        return;
      }

      const parsed = Linking.parse(result.url);
      const code = parsed.queryParams?.code;
      const state = parsed.queryParams?.state;
      const err = parsed.queryParams?.error;

      if (err || !code || !state) {
        throw new Error(parsed.queryParams?.error_description || err || 'Missing OAuth callback parameters');
      }

      setAuthStep('exchanging');
      const session = await apiRequest('/auth/github/exchange', {
        method: 'POST',
        skipAuth: true,
        body: { code: String(code), state: String(state), deviceName: 'Android Mobile' },
      });

      await setAuthenticated({
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });

      if (session.user?.onboardingCompleted) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(onboarding)/setup');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Unable to complete GitHub sign-in.');
      setAuthStep('idle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.heroWrap}>
        <RelayBrandMark size={60} variant="dark" />
        <Text style={[typography.title, { color: '#FFFFFF', marginTop: 18 }]}>
          Build, deploy, monitor, and respond — anywhere.
        </Text>
        <Text style={[typography.body, { color: '#C5D4E2', marginTop: 8 }]}>
          Safe mobile code edits, Render deployments, health probing, and incident resolution in one connected workflow.
        </Text>
      </View>

      <SignalBanner>
        <Text style={[typography.caption, { color: colors.primary }]}>ON-01 · ON-02 · SECURITY MODEL</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 4 }]}>
          Separated Identity & Repo Access
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          Step 1 verifies your GitHub identity via PKCE OAuth. Step 2 authorizes specific repositories via the PocketOps GitHub App.
        </Text>
      </SignalBanner>

      {errorMsg ? (
        <ErrorState
          title="Authentication Error (ON-04)"
          message={errorMsg}
          onRetry={handleGitHubSignIn}
        />
      ) : null}

      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>1. Source Code Safety</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          CodeMirror 6 editor with encrypted offline drafts and remote SHA conflict checks before every commit.
        </Text>
      </SignalCard>

      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>2. Production Operations</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          Inspect Render build & runtime logs, confirm redeployments explicitly, and verify health recovery.
        </Text>
      </SignalCard>

      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>3. Auditable Incidents</Text>
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          Track P1–P3 incidents across open, investigating, mitigating, monitoring, and verified resolved states.
        </Text>
      </SignalCard>

      <PrimaryButton
        label={
          authStep === 'exchanging'
            ? 'Exchanging PKCE Session...'
            : authStep === 'oauth'
            ? 'Waiting for GitHub...'
            : 'Sign in with GitHub'
        }
        loading={loading}
        onPress={handleGitHubSignIn}
        style={{ marginTop: 6 }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    backgroundColor: '#0B1F36',
    borderRadius: 18,
    padding: 20,
    marginTop: 12,
    marginBottom: 16,
  },
});
