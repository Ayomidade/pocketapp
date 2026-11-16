import React, { useState } from 'react';
import { Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
          title="Projects & Code"
          subtitle="Link repositories and Render services into unified operational workspaces"
        />

        <SignalBanner>
          <View style={styles.rowBetween}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>Repository Explorer</Text>
            <StatusBadge status="info" label="GitHub App" />
          </View>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
            Browse branches, inspect files, and edit code in CodeMirror 6 directly from any project or repository.
          </Text>
          <SecondaryButton
            label="Browse All Repositories (RP-01)"
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
            actionLabel="Create Project (PJ-02)"
            onAction={() => setModalOpen(true)}
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
            <PrimaryButton label="New Project" onPress={() => setModalOpen(true)} />
          </>
        )}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Create Project</Text>
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
            <PrimaryButton
              label="Create Project"
              loading={createMutation.isPending}
              onPress={() => createMutation.mutate({ name: name.trim(), description: description.trim() })}
              disabled={name.trim().length < 2}
              style={{ marginTop: 14 }}
            />
            <SecondaryButton label="Cancel" onPress={() => setModalOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingHorizontal: 18, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 12, fontSize: 15 },
});
