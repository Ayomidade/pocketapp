import React, { useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalCard, SignalIntro } from '../../src/components/SignalCard';
import { SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function InboxTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography } = useTheme();
  const [selected, setSelected] = useState(null);

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
    setSelected(null);
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
          title="Notification center"
        />
        <SignalIntro eyebrow="Activity" title="Notification center" description="Review incident alerts, deployment events, and other account notices." />
        <SecondaryButton label="Back to activity" onPress={() => router.replace('/(tabs)/activity')} style={{ marginBottom: 16 }} />
        {(data?.notifications || []).some((n) => !n.readAt) ? <SecondaryButton label="Mark all read" disabled={markAllMutation.isPending} onPress={() => markAllMutation.mutate()} style={{ marginBottom: 16 }} /> : null}
        {markAllMutation.error ? <ErrorState title="Could not mark notifications read" message={markAllMutation.error.message} /> : null}
        {markReadMutation.error ? <ErrorState title="Could not mark notification read" message={markReadMutation.error.message} /> : null}

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}

        {!isLoading && !error && (data?.notifications || []).length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Inbox Clear"
            description="Incident alerts, deployment failures, and health updates will appear here."
          />
        ) : (
          (data?.notifications || []).map((n) => (
            <SignalCard
              key={n.id}
              onPress={() => { setSelected(n); if (!n.readAt) markReadMutation.mutate(n.id); }}
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
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {selected ? <>
              <StatusBadge status={selected.severity} label={selected.eventType.replace(/_/g, ' ')} />
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: 12 }]}>{selected.title}</Text>
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{selected.body}</Text>
              {selected.createdAt ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{new Date(selected.createdAt).toLocaleString()}</Text> : null}
              {selected.resourceId && ['incident', 'service', 'repository'].includes(selected.resourceType) ? <SecondaryButton label={`Open ${selected.resourceType}`} onPress={() => openDestination(selected)} style={{ marginTop: 16 }} /> : null}
            </> : null}
            <SecondaryButton label="Close" onPress={() => setSelected(null)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingHorizontal: 18, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
});
