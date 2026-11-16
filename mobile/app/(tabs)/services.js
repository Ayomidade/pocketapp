import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function ServicesTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography } = useTheme();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest('/services'),
  });

  const discoverMutation = useMutation({
    mutationFn: () => apiRequest('/services/discover', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return (
    <ScreenContainer scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <ModuleHeader
          code="SV"
          title="Render Services"
          subtitle="Production health status, deployments, and runtime logs"
        />

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}
        {discoverMutation.error ? (
          <ErrorState title="Render Discovery Notice" message={discoverMutation.error.message} />
        ) : null}

        {!isLoading && !error && (data?.services || []).length === 0 ? (
          <EmptyState
            icon="server-outline"
            title="No Render Services Discovered"
            description="Connect your Render API key in Settings or Onboarding, then discover your deployed services."
            actionLabel="Discover Render Services"
            onAction={() => discoverMutation.mutate()}
          />
        ) : (
          <>
            {(data?.services || []).map((svc) => (
              <SignalCard key={svc.id} onPress={() => router.push(`/services/${svc.id}`)}>
                <View style={styles.rowBetween}>
                  <Text style={[typography.heading, { color: colors.textPrimary }]}>{svc.name}</Text>
                  <StatusBadge status={svc.effectiveHealthStatus || svc.lastHealthStatus} />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  {svc.serviceType} · {svc.repoFullName || 'Manual deploy'} · Branch: {svc.branch || 'main'}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  Latency: {svc.lastLatencyMs ? `${svc.lastLatencyMs}ms` : 'Unchecked'}
                </Text>
              </SignalCard>
            ))}
            <PrimaryButton
              label="Sync Services from Render"
              loading={discoverMutation.isPending}
              onPress={() => discoverMutation.mutate()}
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingHorizontal: 18, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
