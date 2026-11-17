import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [section, setSection] = useState('overview');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest(`/projects/${id}`),
  });

  const repositoriesQuery = useQuery({
    queryKey: ['repositories'],
    queryFn: () => apiRequest('/repositories'),
    enabled: linkModalOpen,
  });

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: () => apiRequest('/services'),
    enabled: linkModalOpen,
  });

  const linkMutation = useMutation({
    mutationFn: (payload) => apiRequest(`/projects/${id}/links`, { method: 'PUT', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setLinkModalOpen(false);
    },
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <ModuleHeader code="PJ" title="Project" showBack />
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error || !data?.project) {
    return (
      <ScreenContainer>
        <ModuleHeader code="PJ" title="Project" showBack />
        <ErrorState message={error?.message} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const { project, incidents = [], recentDeployments = [], activity = [] } = data;

  const openLinker = () => {
    setSelectedRepos((project.repositories || []).map((r) => r.id));
    setSelectedServices((project.services || []).map((s) => s.id));
    setLinkModalOpen(true);
  };

  const toggleId = (list, setList, itemId) => {
    setList(list.includes(itemId) ? list.filter((x) => x !== itemId) : [...list, itemId]);
  };

  return (
    <ScreenContainer>
      <ModuleHeader
        code="PJ"
        title={project.name}
        subtitle={project.description || `${project.environment} workspace`}
        showBack
      />

      <SignalBanner>
        <Text style={[typography.badge, { color: colors.primary, marginBottom: 6 }]}>PROJECT</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>{project.name}</Text>
        <View style={styles.rowBetween}>
          <StatusBadge status="info" label={project.environment} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {(project.repositories || []).length} repos · {(project.services || []).length} services
          </Text>
        </View>
        <SecondaryButton
          label="Link Repositories & Services"
          onPress={openLinker}
          style={{ marginTop: 12 }}
        />
      </SignalBanner>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sectionBar} contentContainerStyle={styles.sectionContent}>
        {['overview', 'repositories', 'services', 'activity'].map((item) => (
          <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => setSection(item)} style={[styles.sectionTab, { borderColor: section === item ? colors.primary : colors.border, backgroundColor: section === item ? colors.bannerMuted : colors.surface, borderRadius: radii.pill }]}>
            <Text style={[typography.caption, { color: section === item ? colors.primary : colors.textSecondary, textTransform: 'capitalize' }]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* PJ-04 Project Repositories */}
      {section === 'overview' || section === 'repositories' ? <>
      <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>
        Linked Repositories
      </Text>
      {(project.repositories || []).length === 0 ? (
        <SignalCard>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            No repositories linked yet.
          </Text>
        </SignalCard>
      ) : (
        project.repositories.map((repo) => (
          <SignalCard key={repo.id} onPress={() => router.push(`/repositories/${repo.id}`)}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{repo.fullName}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              Default branch: {repo.defaultBranch} · {repo.language || 'Code'}
            </Text>
          </SignalCard>
        ))
      )}
      </> : null}

      {/* PJ-05 Project Services */}
      {section === 'overview' || section === 'services' ? <>
      <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6, marginBottom: 8 }]}>
        Linked Render Services
      </Text>
      {(project.services || []).length === 0 ? (
        <SignalCard>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            No Render services linked yet.
          </Text>
        </SignalCard>
      ) : (
        project.services.map((svc) => (
          <SignalCard key={svc.id} onPress={() => router.push(`/services/${svc.id}`)}>
            <View style={styles.rowBetween}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{svc.name}</Text>
              <StatusBadge status={svc.lastHealthStatus} />
            </View>
          </SignalCard>
        ))
      )}
      </> : null}

      {/* PJ-06 Project Activity */}
      {section === 'overview' ? <>
      <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6, marginBottom: 8 }]}>
        Incidents & Activity
      </Text>
      {incidents.map((inc) => (
        <SignalCard key={inc.id} onPress={() => router.push(`/incidents/${inc.id}`)}>
          <View style={styles.rowBetween}>
            <StatusBadge status={inc.severity} label={inc.severity} />
            <StatusBadge status={inc.status} />
          </View>
          <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 6 }]}>
            {inc.title}
          </Text>
        </SignalCard>
      ))}
      {recentDeployments.map((dep) => (
        <SignalCard key={dep.id} onPress={() => router.push(`/services/${dep.serviceId}`)}>
          <View style={styles.rowBetween}>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              Deploy {dep.commitSha?.slice(0, 7) || dep.renderDeployId?.slice(0, 8) || 'Unknown'}
            </Text>
            <StatusBadge status={dep.status} />
          </View>
        </SignalCard>
      ))}
      {incidents.length === 0 && recentDeployments.length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No recent project activity.</Text></SignalCard> : null}
      </> : null}

      {section === 'activity' ? <>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>Project activity</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>Recent recorded actions for this project and its currently linked resources.</Text>
        {activity.length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No recorded activity yet.</Text></SignalCard> : activity.map((event) => {
          const route = { repository: '/repositories/', service: '/services/', incident: '/incidents/' }[event.resourceType];
          return <SignalCard key={event.id} onPress={route && event.resourceId ? () => router.push(`${route}${event.resourceId}`) : undefined}>
            <View style={styles.rowBetween}><Text style={[typography.bodyBold, { color: colors.textPrimary, flexShrink: 1 }]}>{event.action.replace(/[._]/g, ' ')}</Text><StatusBadge status={event.outcome === 'success' ? 'verified' : 'warning'} label={event.outcome} /></View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>{event.resourceType} · {new Date(event.createdAt).toLocaleString()}</Text>
          </SignalCard>;
        })}
        {activity.length === 50 ? <Text style={[typography.caption, { color: colors.textSecondary }]}>Showing the 50 most recent recorded actions.</Text> : null}
      </> : null}

      <Modal visible={linkModalOpen} transparent animationType="slide" onRequestClose={() => setLinkModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} keyboardShouldPersistTaps="handled">
            <Text style={[typography.title, { color: colors.textPrimary }]}>Configure Project Links</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 10 }]}>
              REPOSITORIES
            </Text>
            {repositoriesQuery.isLoading ? <LoadingState message="Loading repositories…" /> : null}
            {repositoriesQuery.error ? <ErrorState message={repositoriesQuery.error.message} onRetry={repositoriesQuery.refetch} /> : null}
            {(repositoriesQuery.data?.repositories || []).map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedRepos.includes(r.id) }}
                onPress={() => toggleId(selectedRepos, setSelectedRepos, r.id)}
                style={[
                  styles.checkRow,
                  { borderColor: colors.border, borderRadius: radii.pill },
                ]}
              >
                <Text style={[typography.body, { color: colors.textPrimary }]}>{r.fullName}</Text>
                <StatusBadge
                  status={selectedRepos.includes(r.id) ? 'verified' : 'unknown'}
                  label={selectedRepos.includes(r.id) ? 'Linked' : 'Tap to link'}
                />
              </Pressable>
            ))}

            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12 }]}>
              RENDER SERVICES
            </Text>
            {servicesQuery.isLoading ? <LoadingState message="Loading services…" /> : null}
            {servicesQuery.error ? <ErrorState message={servicesQuery.error.message} onRetry={servicesQuery.refetch} /> : null}
            {(servicesQuery.data?.services || []).map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedServices.includes(s.id) }}
                onPress={() => toggleId(selectedServices, setSelectedServices, s.id)}
                style={[
                  styles.checkRow,
                  { borderColor: colors.border, borderRadius: radii.pill },
                ]}
              >
                <Text style={[typography.body, { color: colors.textPrimary }]}>{s.name}</Text>
                <StatusBadge
                  status={selectedServices.includes(s.id) ? 'verified' : 'unknown'}
                  label={selectedServices.includes(s.id) ? 'Linked' : 'Tap to link'}
                />
              </Pressable>
            ))}

            <PrimaryButton
              label="Save Associations"
              loading={linkMutation.isPending}
              disabled={!repositoriesQuery.isSuccess || !servicesQuery.isSuccess}
              onPress={() =>
                linkMutation.mutate({ repositoryIds: selectedRepos, serviceIds: selectedServices })
              }
              style={{ marginTop: 14 }}
            />
            {linkMutation.error ? <ErrorState message={linkMutation.error.message} /> : null}
            <SecondaryButton label="Cancel" onPress={() => setLinkModalOpen(false)} style={{ marginTop: 8 }} />
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
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: '85%' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    minHeight: 48,
  },
});
