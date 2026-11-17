import React, { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function IncidentsTabScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const [filter, setFilter] = useState('active'); // 'active' | 'resolved'
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState('P1');

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['incidents', filter],
    queryFn: () => apiRequest(`/incidents?status=${filter}`),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => apiRequest('/incidents', { method: 'POST', body: payload }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTitle('');
      setSummary('');
      setCreateOpen(false);
      if (res?.incident?.id) router.push(`/incidents/${res.incident.id}`);
    },
  });

  return (
    <ScreenContainer scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <ModuleHeader
          code="IN"
          title="Incident inbox"
        />

        <SignalBanner><Text style={[typography.badge, { color: colors.primary }]}>INCIDENTS</Text><Text style={[typography.title, { color: colors.textPrimary, marginTop: 8 }]}>Incident inbox</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Review active incidents and their recovery evidence.</Text></SignalBanner>

        {/* Active / Resolved Segmented Filter (IN-01 vs IN-10) */}
        <View style={[styles.segmentRow, { backgroundColor: colors.bannerMuted, borderRadius: radii.button }]}>
          {['active', 'resolved'].map((key) => (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[
                styles.segmentBtn,
                filter === key && { backgroundColor: colors.surface, borderRadius: radii.pill },
              ]}
            >
              <Text style={[typography.bodyBold, { color: filter === key ? colors.primary : colors.textSecondary }]}>
                {key === 'active' ? 'Active' : 'Resolved History'}
              </Text>
            </Pressable>
          ))}
        </View>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}

        {!isLoading && !error && (data?.incidents || []).length === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title={filter === 'active' ? 'No Active Incidents' : 'No Resolved Incidents'}
            description={
              filter === 'active'
                ? 'No active incidents are recorded. Declare an incident if you spot an anomaly.'
                : 'Resolved incidents with complete timelines appear here.'
            }
            actionLabel={filter === 'active' ? 'Create Incident' : undefined}
            onAction={filter === 'active' ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <>
            {(data?.incidents || []).map((inc) => (
              <SignalCard key={inc.id} onPress={() => router.push(`/incidents/${inc.id}`)}>
                <View style={styles.rowBetween}>
                  <StatusBadge status={inc.severity} label={inc.severity} />
                  <StatusBadge status={inc.status} />
                </View>
                <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>
                  {inc.title}
                </Text>
                {inc.summary ? (
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                    {inc.summary}
                  </Text>
                ) : null}
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
                  {(inc.resources || []).length} linked resources · Opened {new Date(inc.openedAt).toLocaleString()}
                </Text>
              </SignalCard>
            ))}
            <PrimaryButton label="Declare Incident" tone="danger" onPress={() => setCreateOpen(true)} />
          </>
        )}
      </ScrollView>

      {/* IN-02 Create Incident Modal */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => { if (!createMutation.isPending) setCreateOpen(false); }}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[typography.title, { color: colors.textPrimary }]}>Declare Incident</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>Record the impact and choose the incident severity.</Text>
            <View style={styles.sevRow}>
              {['P1', 'P2', 'P3'].map((sev) => (
                <Pressable
                  key={sev}
                  onPress={() => setSeverity(sev)}
                  style={[
                    styles.sevBtn,
                    {
                      borderColor: severity === sev ? colors.primary : colors.border,
                      backgroundColor: severity === sev ? colors.bannerMuted : colors.surfaceSubtle,
                      borderRadius: radii.pill,
                    },
                  ]}
                >
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{sev}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Incident title (e.g. 502 spike on checkout-api)"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder="Initial symptoms and impact"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                { minHeight: 80, textAlignVertical: 'top', paddingTop: 10, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <PrimaryButton
              label="Open Incident"
              tone="danger"
              loading={createMutation.isPending}
              disabled={title.trim().length < 3}
              onPress={() => createMutation.mutate({ title: title.trim(), summary: summary.trim(), severity })}
              style={{ marginTop: 14 }}
            />
            {createMutation.error ? <ErrorState title="Could not create incident" message={createMutation.error.message} /> : null}
            <SecondaryButton label="Cancel" disabled={createMutation.isPending} onPress={() => setCreateOpen(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingHorizontal: 18, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  segmentRow: { flexDirection: 'row', padding: 4, marginBottom: 14 },
  segmentBtn: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { paddingHorizontal: 20, maxHeight: '85%', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
  modalContent: { paddingTop: 20, paddingBottom: 28 },
  sevRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sevBtn: { flex: 1, minHeight: 48, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 12, fontSize: 15 },
});
