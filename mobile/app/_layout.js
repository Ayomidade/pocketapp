/* global __DEV__ */
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useAuthStore } from '../src/store/useAuthStore';
import { apiRequest } from '../src/services/apiClient';
import { getAccessToken } from '../src/security/tokenStorage';
import { DesignPreview } from '../src/preview/DesignPreview';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15000 },
  },
});

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isDark, colors } = useTheme();
  const { status, user, setAuthenticated, signOutLocal } = useAuthStore();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          await signOutLocal();
          return;
        }
        const me = await apiRequest('/auth/me');
        await setAuthenticated({ user: me.user });
      } catch {
        await signOutLocal();
      }
    })();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const deepLink = response?.notification?.request?.content?.data?.deepLink;
      if (!deepLink || typeof deepLink !== 'string') return;
      if (deepLink.includes('incidents/')) {
        const id = deepLink.split('incidents/')[1];
        router.push(`/incidents/${id}`);
      } else if (deepLink.includes('services/')) {
        const id = deepLink.split('services/')[1].split('/')[0];
        router.push(`/services/${id}`);
      } else if (deepLink.includes('repositories/')) {
        const id = deepLink.split('repositories/')[1];
        router.push(`/repositories/${id}`);
      } else {
        router.push('/(tabs)/inbox');
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (status === 'booting') return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (status === 'authenticated') {
      if (user && !user.onboardingCompleted && !inOnboardingGroup) {
        router.replace('/(onboarding)/setup');
      } else if (user?.onboardingCompleted && (inAuthGroup || inOnboardingGroup)) {
        router.replace('/(tabs)');
      }
    }
  }, [status, user, segments, router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const preview = __DEV__ && process.env.EXPO_PUBLIC_DESIGN_PREVIEW === 'true';
  const previewMode = process.env.EXPO_PUBLIC_DESIGN_THEME === 'dark' ? 'dark' : 'light';
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider previewMode={preview ? previewMode : undefined}>
          {preview ? <DesignPreview /> : <RootNavigator />}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
