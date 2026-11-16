import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalCard } from '../../src/components/SignalCard';
import { SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function InboxTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography } = useTheme();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiRequest('/ops/notifications'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => apiRequest(`/ops/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest('/ops/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const openDestination = (notif) => {
    if (!notif.readAt) markReadMutation.mutate(notif.id);
    if (notif.resourceType === 'incident' && notif.resourceId) {
      router.push(`/incidents/${notif.resourceId}`);
    } else if (notif.resourceType === 'service' && notif.resourceId) {
      router.push(`/services/${notif.resourceId}`);
    } else if (notif.resourceType === 'repository' && notif.resourceId) {
      router.push(`/repositories/${notif.resourceId}`);
    }
  };

  return (
    <ScreenContainer scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <ModuleHeader
          code="AC"
          title="Notification Center"
          subtitle="Persistent operational alerts and activity history"
          rightAction={
            <SecondaryButton label="Mark All Read" onPress={() => markAllMutation.mutate()} />
          }
        />

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}

        {!isLoading && !error && (data?.notifications || []).length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Inbox Clear"
            description="Backend incident alerts, deployment failures, health transitions, and recovery events persist here reliably even if push delivery is delayed."
          />
        ) : (
          (data?.notifications || []).map((n) => (
            <SignalCard
              key={n.id}
              onPress={() => openDestination(n)}
              style={!n.readAt ? { borderColor: colors.primary, borderWidth: 1.5 } : undefined}
            >
              <View style={styles.rowBetween}>
                <StatusBadge status={n.severity} label={n.eventType.replace(/_/g, ' ')} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {n.readAt ? 'Read' : 'Unread'}
                </Text>
              </View>
              <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>
                {n.title}
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                {n.body}
              </Text>
            </SignalCard>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingHorizontal: 18, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
