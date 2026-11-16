import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest(`/projects/${id}`),
  });

  const { data: reposData } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => apiRequest('/repositories'),
    enabled: linkModalOpen,
  });

  const { data: servicesData } = useQuery({
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

  const { project, incidents = [], recentDeployments = [] } = data;

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
        <View style={styles.rowBetween}>
          <StatusBadge status="info" label={project.environment} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {(project.repositories || []).length} repos · {(project.services || []).length} services
          </Text>
        </View>
        <SecondaryButton
          label="Link Repositories & Services (PJ-02)"
          onPress={openLinker}
          style={{ marginTop: 12 }}
        />
      </SignalBanner>

      {/* PJ-04 Project Repositories */}
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

      {/* PJ-05 Project Services */}
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

      {/* PJ-06 Project Activity */}
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
              Deploy {dep.commitSha?.slice(0, 7) || dep.renderDeployId.slice(0, 8)}
            </Text>
            <StatusBadge status={dep.status} />
          </View>
        </SignalCard>
      ))}

      <Modal visible={linkModalOpen} transparent animationType="slide" onRequestClose={() => setLinkModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Configure Project Links</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 10 }]}>
              REPOSITORIES
            </Text>
            {(reposData?.repositories || []).map((r) => (
              <Pressable
                key={r.id}
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
            {(servicesData?.services || []).map((s) => (
              <Pressable
                key={s.id}
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
              onPress={() =>
                linkMutation.mutate({ repositoryIds: selectedRepos, serviceIds: selectedServices })
              }
              style={{ marginTop: 14 }}
            />
            <SecondaryButton label="Cancel" onPress={() => setLinkModalOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
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
