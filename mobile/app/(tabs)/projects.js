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

export default function ProjectsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);

  const availableRepos = useQuery({ queryKey: ['repositories'], queryFn: () => apiRequest('/repositories'), enabled: modalOpen });
  const availableServices = useQuery({ queryKey: ['services'], queryFn: () => apiRequest('/services'), enabled: modalOpen });
  const toggle = (value, setter) => setter((items) => items.includes(value) ? items.filter((item) => item !== value) : [...items, value]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest('/projects'),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => apiRequest('/projects', { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setName('');
      setDescription('');
      setSelectedRepos([]);
      setSelectedServices([]);
      setEnvironment('production');
      setModalOpen(false);
    },
  });

  return (
    <ScreenContainer scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <ModuleHeader
          code="PJ"
          title="Project library"
          subtitle="Your repositories and services, organized together"
        />

        <SignalBanner>
          <View style={styles.rowBetween}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>Projects</Text>
            {data ? <StatusBadge status="info" label={`${data.projects.length} projects`} /> : null}
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
            Group repositories, services, and incidents in a workspace for your team.
          </Text>
          <PrimaryButton label="Create project" onPress={() => setModalOpen(true)} style={{ marginTop: 12 }} />
          <SecondaryButton
            label="Browse All Repositories"
            onPress={() => router.push('/repositories')}
            style={{ marginTop: 12 }}
          />
        </SignalBanner>

        {isLoading ? <LoadingState /> : null}
        {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}

        {!isLoading && !error && (data?.projects || []).length === 0 ? (
          <EmptyState
            icon="folder-outline"
            title="No Projects Yet"
            description="Create a PocketOps Project to group a repository, its Render services, and active incidents together."
          />
        ) : (
          <>
            {(data?.projects || []).map((project) => (
              <SignalCard key={project.id} onPress={() => router.push(`/projects/${project.id}`)}>
                <View style={styles.rowBetween}>
                  <Text style={[typography.heading, { color: colors.textPrimary }]}>{project.name}</Text>
                  <StatusBadge status="info" label={project.environment} />
                </View>
                {project.description ? (
                  <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
                    {project.description}
                  </Text>
                ) : null}
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
                  {(project.repositories || []).length} Repositories · {(project.services || []).length} Services
                </Text>
              </SignalCard>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} keyboardShouldPersistTaps="handled">
            <Text style={[typography.title, { color: colors.textPrimary }]}>Create Project</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>Name your workspace and choose the resources to link. You can change links later.</Text>
            <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 12 }]}>Project name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Project name (e.g. Checkout Core)"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 12 }]}>Description (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Operational summary"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 16 }]}>Environment</Text>
            <View style={styles.optionsRow}>{['production', 'staging', 'development'].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: environment === value }} onPress={() => setEnvironment(value)} style={[styles.option, { borderColor: environment === value ? colors.primary : colors.border, borderRadius: radii.pill }]}><Text style={[typography.caption, { color: colors.textPrimary, textTransform: 'capitalize' }]}>{value}</Text></Pressable>)}</View>
            <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 16 }]}>Repositories</Text>
            {availableRepos.isLoading ? <LoadingState message="Loading repositories…" /> : null}
            {availableRepos.error ? <ErrorState message={availableRepos.error.message} onRetry={availableRepos.refetch} /> : null}
            {(availableRepos.data?.repositories || []).map((repo) => <Pressable key={repo.id} accessibilityRole="checkbox" accessibilityState={{ checked: selectedRepos.includes(repo.id) }} onPress={() => toggle(repo.id, setSelectedRepos)} style={[styles.choice, { borderColor: colors.border, borderRadius: radii.pill }]}><Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{repo.fullName}</Text><StatusBadge status={selectedRepos.includes(repo.id) ? 'verified' : 'unknown'} label={selectedRepos.includes(repo.id) ? 'Selected' : 'Optional'} /></Pressable>)}
            <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 16 }]}>Services</Text>
            {availableServices.isLoading ? <LoadingState message="Loading services…" /> : null}
            {availableServices.error ? <ErrorState message={availableServices.error.message} onRetry={availableServices.refetch} /> : null}
            {(availableServices.data?.services || []).map((service) => <Pressable key={service.id} accessibilityRole="checkbox" accessibilityState={{ checked: selectedServices.includes(service.id) }} onPress={() => toggle(service.id, setSelectedServices)} style={[styles.choice, { borderColor: colors.border, borderRadius: radii.pill }]}><Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{service.name}</Text><StatusBadge status={selectedServices.includes(service.id) ? 'verified' : 'unknown'} label={selectedServices.includes(service.id) ? 'Selected' : 'Optional'} /></Pressable>)}
            {createMutation.error ? <ErrorState title="Could not create project" message={createMutation.error.message} /> : null}
            <PrimaryButton
              label="Create Project"
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate({ name: name.trim(), description: description.trim(), environment, repositoryIds: selectedRepos, serviceIds: selectedServices })}
              disabled={name.trim().length < 2}
              style={{ marginTop: 14 }}
            />
            <SecondaryButton label="Cancel" onPress={() => setModalOpen(false)} style={{ marginTop: 10 }} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingHorizontal: 18, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: '90%' },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  option: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  choice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderWidth: 1, gap: 8, padding: 12, marginTop: 8 },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 12, fontSize: 15 },
});
