import React, { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { SignalBanner } from '../../src/components/SignalCard';
import { ContextCard } from '../../src/components/ContextCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { ModuleHeader } from '../../src/components/ModuleHeader';
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

  if (loading || errorMsg) {
    return <ScreenContainer>
      <ModuleHeader title={errorMsg ? 'Sign-in interrupted' : authStep === 'exchanging' ? 'Finishing sign-in' : 'Connect to GitHub'} subtitle="Secure access to your PocketOps workspace" />
      <SignalBanner>
        {loading ? <ActivityIndicator color={colors.primary} accessibilityLabel="Sign-in in progress" /> : null}
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typography.heading, { color: colors.textPrimary, marginTop: 12 }]}>{errorMsg ? 'We could not complete sign-in' : authStep === 'exchanging' ? 'Verifying your account' : 'Waiting for GitHub'}</Text>
        <Text accessibilityLiveRegion="polite" style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{errorMsg || (authStep === 'exchanging' ? 'Your GitHub response was received. Securely finishing your session…' : 'Complete sign-in in the browser, then return to PocketOps.')}</Text>
      </SignalBanner>
      {errorMsg ? <><PrimaryButton label="Try GitHub sign-in again" onPress={handleGitHubSignIn} /><SecondaryButton label="Back to welcome" onPress={() => setErrorMsg(null)} style={{ marginTop: 10 }} /></> : null}
      {loading && authStep === 'oauth' ? <SecondaryButton label="Cancel browser sign-in" onPress={() => WebBrowser.dismissAuthSession()} /> : null}
    </ScreenContainer>;
  }

  return <WelcomeContent onSignIn={handleGitHubSignIn} loading={loading} />;
}

export function WelcomeContent({ onSignIn, loading = false }) {
  const { colors, typography } = useTheme();
  return (
    <ScreenContainer>
      <ModuleHeader code="ON" title="Welcome" />
      <SignalBanner>
        <Text style={[typography.badge, { color: colors.primary }]}>SECURE ACCESS</Text>
        <Text style={[typography.title, { color: colors.textPrimary, marginTop: 8 }]}>
          Your workspace, wherever you are
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
          Explore GitHub repositories, review changes and respond to production issues.
        </Text>
      </SignalBanner>
      <ContextCard title="Repository context" description="Choose which repositories the GitHub App can access." />
      <ContextCard title="Operation state" description="Review changes and confirm actions before they run." />
      <ContextCard title="Verification" description="Check current provider data before acting." />
      <PrimaryButton label="Continue with GitHub" loading={loading} onPress={onSignIn} align="left" />
      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 14 }]}>Secure sign-in with GitHub</Text>
    </ScreenContainer>
  );
}
