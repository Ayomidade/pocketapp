import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();

  const [noteInput, setNoteInput] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [section, setSection] = useState('overview');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => apiRequest(`/incidents/${id}`),
  });
  const repos = useQuery({ queryKey: ['repositories'], queryFn: () => apiRequest('/repositories'), enabled: linkOpen });
  const services = useQuery({ queryKey: ['services'], queryFn: () => apiRequest('/services'), enabled: linkOpen });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['incident', id] });
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status) => apiRequest(`/incidents/${id}/status`, { method: 'POST', body: { status } }),
    onSuccess: invalidate,
  });

  const noteMutation = useMutation({
    mutationFn: (eventType) =>
      apiRequest(`/incidents/${id}/events`, {
        method: 'POST',
        body: { eventType, message: noteInput.trim() },
      }),
    onSuccess: () => {
      setNoteInput('');
      invalidate();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiRequest(`/incidents/${id}/verify-recovery`, { method: 'POST' }),
    onSuccess: invalidate,
  });
  const linkMutation = useMutation({
    mutationFn: (resource) => apiRequest(`/incidents/${id}/resources`, { method: 'POST', body: resource }),
    onSuccess: () => { setLinkOpen(false); invalidate(); },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/incidents/${id}/resolve`, {
        method: 'POST',
        idempotent: true,
        body: { confirmResolution: true, resolutionSummary: resolutionSummary.trim() },
      }),
    onSuccess: () => {
      setResolveOpen(false);
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <ModuleHeader code="IN" title="Incident" showBack />
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error || !data?.incident) {
    return (
      <ScreenContainer>
        <ModuleHeader code="IN" title="Incident" showBack />
        <ErrorState message={error?.message} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const inc = data.incident;
  const isResolved = inc.status === 'resolved';
  const recoveryEvent = [...(inc.events || [])].reverse().find((event) => event.eventType === 'recovery_verified');

  const openLinkedResource = (res) => {
    if (res.resourceType === 'service') router.push(`/services/${res.resourceRef}`);
    else if (res.resourceType === 'repository') router.push(`/repositories/${res.resourceRef}`);
  };

  return (
    <ScreenContainer>
      <ModuleHeader
        code="IN"
        title={inc.title}
        subtitle={`Opened ${new Date(inc.openedAt).toLocaleString()}`}
        showBack
      />

      <SignalBanner>
        <Text style={[typography.badge, { color: colors.primary, marginBottom: 6 }]}>INCIDENT</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>Incident overview</Text>
        <View style={styles.rowBetween}>
          <StatusBadge status={inc.severity} label={inc.severity} />
          <StatusBadge status={inc.status} />
        </View>
        {inc.summary ? (
          <Text style={[typography.body, { color: colors.textPrimary, marginTop: 8 }]}>
            {inc.summary}
          </Text>
        ) : null}

        {/* Lifecycle Transitions */}
        {!isResolved ? (
          <View style={styles.stateRow}>
            {['investigating', 'mitigating', 'monitoring'].map((st) => (
              <SecondaryButton
                key={st}
                label={st}
                disabled={inc.status === st || statusMutation.isPending}
                onPress={() => statusMutation.mutate(st)}
                style={styles.stateBtn}
              />
            ))}
          </View>
        ) : (
          <SecondaryButton
            label="Reopen Incident"
            onPress={() => statusMutation.mutate('open')}
            style={{ marginTop: 12 }}
          />
        )}
      </SignalBanner>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionBar} contentContainerStyle={styles.sectionContent}>
        {['overview', 'resources', 'investigation', 'recovery', 'timeline'].map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => setSection(item)} style={[styles.sectionTab, { borderColor: section === item ? colors.primary : colors.border, backgroundColor: section === item ? colors.bannerMuted : colors.surface, borderRadius: radii.pill }]}><Text style={[typography.caption, { color: section === item ? colors.primary : colors.textSecondary, textTransform: 'capitalize' }]}>{item}</Text></Pressable>)}
      </ScrollView>

      {/* IN-07 Linked Resources */}
      {section === 'overview' || section === 'resources' ? <>
      <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>
        Linked Resources
      </Text>
      {(inc.resources || []).length === 0 ? (
        <SignalCard>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            No linked services or repositories yet.
          </Text>
        </SignalCard>
      ) : (
        inc.resources.map((res) => (
          <SignalCard key={res.id} onPress={() => openLinkedResource(res)}>
            <View style={styles.rowBetween}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{res.label}</Text>
              <StatusBadge status="info" label={res.resourceType} />
            </View>
          </SignalCard>
        ))
      )}
      {!isResolved ? <SecondaryButton label="Link a service or repository" onPress={() => setLinkOpen(true)} style={{ marginBottom: 16 }} /> : null}
      </> : null}

      {/* IN-04 / IN-06 Notes & Mitigations */}
      {section === 'overview' || section === 'investigation' ?
      <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>
          Investigation & mitigation
        </Text>
        <TextInput
          value={noteInput}
          onChangeText={setNoteInput}
          placeholder="Record root cause note or mitigation step..."
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[
            styles.input,
            { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
          ]}
        />
        <View style={styles.stateRow}>
          <SecondaryButton
            label="Add Note"
            disabled={!noteInput.trim()}
            onPress={() => noteMutation.mutate('note')}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="Log Mitigation"
            disabled={!noteInput.trim()}
            onPress={() => noteMutation.mutate('mitigation')}
            style={{ flex: 1 }}
          />
        </View>
      </SignalCard> : null}

      {/* IN-08 Recovery Verification & IN-09 Explicit Resolve */}
      {!isResolved && (section === 'overview' || section === 'recovery') ? (
        <SignalCard>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>
            Recovery & resolution
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
            PocketOps never auto-resolves incidents on a single probe. Verify recovery explicitly, then resolve.
          </Text>
          {recoveryEvent ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Latest evidence: {recoveryEvent.message} · {new Date(recoveryEvent.createdAt).toLocaleString()}</Text> : <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>No recovery verification recorded yet.</Text>}
          {verifyMutation.error ? <ErrorState message={verifyMutation.error.message} /> : null}
          <SecondaryButton
            label="Verify Service Recovery Probe"
            onPress={() => verifyMutation.mutate()}
            style={{ marginTop: 12 }}
          />
          <PrimaryButton
            label="Resolve Incident"
            onPress={() => setResolveOpen(true)}
            style={{ marginTop: 10 }}
          />
        </SignalCard>
      ) : null}

      {/* IN-05 Timeline */}
      {section === 'overview' || section === 'timeline' ? <>
      <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6, marginBottom: 8 }]}>
        Auditable Timeline
      </Text>
      {(inc.events || []).map((ev) => (
        <SignalCard key={ev.id}>
          <View style={styles.rowBetween}>
            <StatusBadge status="info" label={ev.eventType.replace(/_/g, ' ')} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              {new Date(ev.createdAt).toLocaleTimeString()}
            </Text>
          </View>
          <Text style={[typography.body, { color: colors.textPrimary, marginTop: 6 }]}>
            {ev.message}
          </Text>
        </SignalCard>
      ))}
      {(inc.events || []).length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No timeline events yet.</Text></SignalCard> : null}
      </> : null}

      {/* IN-09 Resolve Confirmation Modal */}
      <Modal visible={resolveOpen} transparent animationType="slide" onRequestClose={() => setResolveOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Resolve Incident</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{recoveryEvent ? `Latest evidence: ${recoveryEvent.message}` : 'No recovery check has been recorded. Confirm the evidence before resolving.'}</Text>
            <TextInput
              value={resolutionSummary}
              onChangeText={setResolutionSummary}
              placeholder="Summarize root cause & verified fix..."
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.input,
                { minHeight: 84, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            {resolveMutation.error ? (
              <ErrorState title="Cannot Resolve" message={resolveMutation.error.message} />
            ) : null}
            <PrimaryButton
              label="Confirm Explicit Resolution"
              loading={resolveMutation.isPending}
              disabled={resolutionSummary.trim().length < 3}
              onPress={() => resolveMutation.mutate()}
              style={{ marginTop: 12 }}
            />
            <SecondaryButton label="Cancel" onPress={() => setResolveOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={linkOpen} transparent animationType="slide" onRequestClose={() => setLinkOpen(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '85%' }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Link a resource</Text>
            {repos.isLoading || services.isLoading ? <LoadingState message="Loading resources..." /> : null}
            {repos.error || services.error ? <ErrorState message={(repos.error || services.error).message} onRetry={() => { repos.refetch(); services.refetch(); }} /> : null}
            {linkMutation.error ? <ErrorState message={linkMutation.error.message} /> : null}
            {(services.data?.services || []).map((service) => <SignalCard key={`service-${service.id}`} onPress={() => linkMutation.mutate({ resourceType: 'service', resourceRef: service.id, label: service.name })}><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{service.name}</Text><Text style={[typography.caption, { color: colors.textSecondary }]}>Service</Text></SignalCard>)}
            {(repos.data?.repositories || []).map((repo) => <SignalCard key={`repo-${repo.id}`} onPress={() => linkMutation.mutate({ resourceType: 'repository', resourceRef: repo.id, label: repo.fullName })}><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{repo.fullName}</Text><Text style={[typography.caption, { color: colors.textSecondary }]}>Repository</Text></SignalCard>)}
            {!repos.isLoading && !services.isLoading && !repos.error && !services.error && !repos.data?.repositories?.length && !services.data?.services?.length ? <Text style={[typography.body, { color: colors.textSecondary, marginVertical: 16 }]}>No services or repositories are available.</Text> : null}
            <SecondaryButton label="Close" onPress={() => setLinkOpen(false)} style={{ marginVertical: 12 }} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionBar: { flexGrow: 0, marginBottom: 16 },
  sectionContent: { gap: 8 },
  sectionTab: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1 },
  stateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stateBtn: { minHeight: 42, paddingHorizontal: 12 },
  input: { borderWidth: 1, minHeight: 56, paddingHorizontal: 14, paddingTop: 10, marginTop: 10, fontSize: 15 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
});
