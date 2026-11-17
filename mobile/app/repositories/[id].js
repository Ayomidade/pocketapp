import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { useAppStore } from '../../src/store/useAppStore';

export default function RepositoryExplorerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const setActiveEditorFile = useAppStore((s) => s.setActiveEditorFile);

  const [branch, setBranch] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [branchModal, setBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const { data: repoData, isLoading: repoLoading, error: repoError, refetch: refetchRepo } = useQuery({
    queryKey: ['repo', id],
    queryFn: () => apiRequest(`/repositories/${id}`),
  });

  const activeBranch = branch || repoData?.repository?.defaultBranch || 'main';

  const { data: branchesData } = useQuery({
    queryKey: ['repo-branches', id],
    queryFn: () => apiRequest(`/repositories/${id}/branches`),
    enabled: Boolean(repoData?.repository),
  });

  const {
    data: contentsData,
    isLoading: contentsLoading,
    error: contentsError,
    refetch: refetchContents,
  } = useQuery({
    queryKey: ['repo-contents', id, activeBranch, currentPath],
    queryFn: () =>
      apiRequest(
        `/repositories/${id}/contents?path=${encodeURIComponent(currentPath)}&ref=${encodeURIComponent(activeBranch)}`
      ),
    enabled: Boolean(repoData?.repository),
  });

  const createBranchMutation = useMutation({
    mutationFn: (payload) => apiRequest(`/repositories/${id}/branches`, { method: 'POST', body: payload }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['repo-branches', id] });
      setBranch(res.branch.name);
      setNewBranchName('');
      setBranchModal(false);
    },
  });

  if (repoLoading) {
    return (
      <ScreenContainer>
        <ModuleHeader code="RP" title="Repository" showBack />
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (repoError || !repoData?.repository) {
    return (
      <ScreenContainer>
        <ModuleHeader code="RP" title="Access Recovery (RP-07)" showBack />
        <ErrorState
          title="Repository Unavailable"
          message={repoError?.message || 'GitHub App permission may have been revoked.'}
          onRetry={refetchRepo}
        />
        <SecondaryButton label="Check Connections" onPress={() => router.push('/settings')} />
      </ScreenContainer>
    );
  }

  const repo = repoData.repository;
  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  const handleOpenInEditor = (file) => {
    setActiveEditorFile({
      repoId: repo.id,
      repoFullName: repo.fullName,
      branch: activeBranch,
      path: file.path,
      baseSha: file.sha,
      content: file.content || '',
      originalContent: file.content || '',
    });
    router.push('/editor');
  };

  return (
    <ScreenContainer>
      <ModuleHeader
        code="RP"
        title={repo.name}
        subtitle={repo.fullName}
        showBack
      />

      {/* RP-02 / RP-03 Branch Selector */}
      <SignalBanner>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>ACTIVE BRANCH</Text>
            <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 2 }]}>
              {activeBranch}
            </Text>
          </View>
          <SecondaryButton label="Switch / New Branch" onPress={() => setBranchModal(true)} />
        </View>
      </SignalBanner>

      {/* Breadcrumbs (RP-04) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.crumbsRow}>
        <Pressable
          onPress={() => setCurrentPath('')}
          style={[styles.crumbPill, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill }]}
        >
          <Text style={[typography.caption, { color: colors.primary }]}>root</Text>
        </Pressable>
        {breadcrumbs.map((seg, idx) => {
          const pathTo = breadcrumbs.slice(0, idx + 1).join('/');
          return (
            <Pressable
              key={pathTo}
              onPress={() => setCurrentPath(pathTo)}
              style={[styles.crumbPill, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill }]}
            >
              <Text style={[typography.caption, { color: colors.textPrimary }]}>/ {seg}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {contentsLoading ? <LoadingState message="Loading repository tree..." /> : null}
      {contentsError ? <ErrorState message={contentsError.message} onRetry={refetchContents} /> : null}

      {/* Directory Entries (RP-04) */}
      {contentsData?.kind === 'dir'
        ? contentsData.entries.map((entry) => (
            <SignalCard
              key={entry.path}
              onPress={() => setCurrentPath(entry.path)}
              style={styles.entryCard}
            >
              <View style={styles.rowBetween}>
                <View style={styles.entryLeft}>
                  <Ionicons
                    name={entry.type === 'dir' ? 'folder' : 'document-text-outline'}
                    size={20}
                    color={entry.type === 'dir' ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                    {entry.name}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {entry.type === 'dir' ? 'Folder' : `${entry.size} B`}
                </Text>
              </View>
            </SignalCard>
          ))
        : null}

      {/* File Preview & Details (RP-05 / RP-06) */}
      {contentsData?.kind === 'file' ? (
        <>
          <SignalCard>
            <View style={styles.rowBetween}>
              <Text style={[typography.heading, { color: colors.textPrimary }]}>
                {contentsData.file.name}
              </Text>
              <StatusBadge status="info" label={`${contentsData.file.size} B`} />
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              SHA: {contentsData.file.sha.slice(0, 12)} · Branch: {activeBranch}
            </Text>
            <PrimaryButton
              label="Edit File"
              onPress={() => handleOpenInEditor(contentsData.file)}
              style={{ marginTop: 12 }}
            />
          </SignalCard>

          <View
            style={[
              styles.previewBox,
              { backgroundColor: colors.codeSurface, borderColor: colors.border, borderRadius: radii.card },
            ]}
          >
            <ScrollView horizontal>
              <Text style={[typography.mono, { color: colors.codeText }]}>
                {contentsData.file.content}
              </Text>
            </ScrollView>
          </View>
        </>
      ) : null}

      {/* Branch Selector & Create Branch Modal (RP-03, GT-01, GT-02) */}
      <Modal visible={branchModal} transparent animationType="slide" onRequestClose={() => setBranchModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Branches (GT-01)</Text>
            <ScrollView style={{ maxHeight: 220, marginTop: 10 }}>
              {(branchesData?.branches || []).map((b) => (
                <Pressable
                  key={b.name}
                  onPress={() => {
                    setBranch(b.name);
                    setBranchModal(false);
                  }}
                  style={[styles.branchItem, { borderColor: colors.border, borderRadius: radii.pill }]}
                >
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{b.name}</Text>
                  {b.name === activeBranch ? <StatusBadge status="verified" label="Current" /> : null}
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 14 }]}>
              CREATE FIX BRANCH FROM {activeBranch} (GT-02)
            </Text>
            <TextInput
              value={newBranchName}
              onChangeText={setNewBranchName}
              placeholder="fix/stripe-webhook-null-guard"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <PrimaryButton
              label="Create & Switch Branch"
              loading={createBranchMutation.isPending}
              disabled={!newBranchName.trim()}
              onPress={() =>
                createBranchMutation.mutate({
                  branchName: newBranchName.trim(),
                  fromBranch: activeBranch,
                })
              }
              style={{ marginTop: 10 }}
            />
            <SecondaryButton label="Close" onPress={() => setBranchModal(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  crumbsRow: { flexGrow: 0, marginBottom: 12 },
  crumbPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 38,
    justifyContent: 'center',
  },
  entryCard: { paddingVertical: 12 },
  entryLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewBox: { borderWidth: 1, padding: 14, marginBottom: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    minHeight: 48,
  },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 8, fontSize: 15 },
});
