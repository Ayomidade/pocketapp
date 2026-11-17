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
  const [branchMode, setBranchMode] = useState('select');
  const [section, setSection] = useState('overview');
  const [fileDetails, setFileDetails] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const { data: repoData, isLoading: repoLoading, error: repoError, refetch: refetchRepo } = useQuery({
    queryKey: ['repo', id],
    queryFn: () => apiRequest(`/repositories/${id}`),
  });

  const activeBranch = branch || repoData?.repository?.defaultBranch || 'main';

  const branchesQuery = useQuery({
    queryKey: ['repo-branches', id],
    queryFn: () => apiRequest(`/repositories/${id}/branches`),
    enabled: Boolean(repoData?.repository),
  });
  const pullsQuery = useQuery({ queryKey: ['repository-pulls', id], queryFn: () => apiRequest(`/repositories/${id}/pulls`), enabled: Boolean(repoData?.repository) && section === 'pulls' });

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
    enabled: Boolean(repoData?.repository) && section === 'files',
  });

  const createBranchMutation = useMutation({
    mutationFn: (payload) => apiRequest(`/repositories/${id}/branches`, { method: 'POST', body: payload }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['repo-branches', id] });
      setBranch(res.branch.name);
    setNewBranchName('');
    setBranchModal(false);
    setCurrentPath('');
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
        <ModuleHeader code="RP" title="Access Recovery" showBack />
        <ErrorState
          title="Repository Unavailable"
          message={repoError?.code === 'INSTALLATION_UNVERIFIED' ? 'This GitHub App installation is suspended, removed, or has not been verified. Check the installation on GitHub, then reconnect it in Settings.' : repoError?.code === 'REPOSITORY_ACCESS_REVOKED' ? 'Repository access was removed. Restore access on GitHub and sync the installation in Settings.' : repoError?.code === 'REPOSITORY_NOT_FOUND' ? 'This repository is not in your authorized list. It may have been removed, or you may need to sync your GitHub installation.' : repoError?.message || 'Unable to load the repository. Check your connection and retry.'}
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
        <Text style={[typography.badge, { color: colors.primary, marginBottom: 6 }]}>GITHUB</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>{section === 'files' ? 'Repository files' : section === 'pulls' ? 'Pull requests' : 'Repository overview'}</Text>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>ACTIVE BRANCH</Text>
            <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 2 }]}>
              {activeBranch}
            </Text>
          </View>
          <SecondaryButton label="Switch branch" onPress={() => { setBranchMode('select'); setBranchModal(true); }} />
        </View>
      </SignalBanner>

      <View style={styles.sections}>{['overview', 'files', 'pulls'].map((value) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} style={[styles.section, { borderColor: section === value ? colors.primary : colors.border, borderRadius: radii.pill }]}><Text style={[typography.caption, { color: colors.textPrimary }]}>{value === 'pulls' ? 'Pull requests' : value === 'files' ? 'Files' : 'Overview'}</Text></Pressable>)}</View>
      {section === 'overview' ? <>
        <SignalCard><Text style={[typography.heading, { color: colors.textPrimary }]}>{repo.fullName}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{repo.isPrivate ? 'Private' : 'Public'} · Default branch {repo.defaultBranch} · {repo.language || 'Language not specified'}</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Last pushed: {repo.lastPushedAt ? new Date(repo.lastPushedAt).toLocaleString() : 'Unavailable'}</Text><PrimaryButton label="Browse files" onPress={() => setSection('files')} style={{ marginTop: 12 }} /><SecondaryButton label="View pull requests" onPress={() => setSection('pulls')} style={{ marginTop: 8 }} /></SignalCard>
      </> : null}
      {section === 'pulls' ? <>
        {pullsQuery.isLoading ? <LoadingState message="Loading pull requests…" /> : null}
        {pullsQuery.error ? <ErrorState message={pullsQuery.error.message} onRetry={pullsQuery.refetch} /> : null}
        {pullsQuery.isSuccess && !pullsQuery.data.pullRequests.length ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No pull requests found.</Text></SignalCard> : null}
        {(pullsQuery.data?.pullRequests || []).map((pr) => <SignalCard key={pr.number} onPress={() => router.push({ pathname: '/repositories/pull', params: { id: repo.id, number: pr.number, repo: repo.fullName } })}><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>#{pr.number} · {pr.title}</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>{pr.state} · {pr.head} → {pr.base}</Text></SignalCard>)}
      </> : null}

      {/* Breadcrumbs */}
      {section === 'files' ? <>
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

      {/* Directory Entries */}
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
      {contentsData?.kind === 'dir' && contentsData.entries.length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>This directory is empty.</Text></SignalCard> : null}

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
              disabled={contentsData.file.editable === false || typeof contentsData.file.content !== 'string'}
              style={{ marginTop: 12 }}
            />
            <SecondaryButton label="File details" onPress={() => setFileDetails(true)} style={{ marginTop: 8 }} />
            {contentsData.file.editable === false || typeof contentsData.file.content !== 'string' ? <Text style={[typography.caption, { color: colors.warning, marginTop: 8 }]}>This file cannot be safely displayed as text. Open it on GitHub to view or edit it.</Text> : null}
          </SignalCard>

          <View
            style={[
              styles.previewBox,
              { backgroundColor: colors.codeSurface, borderColor: colors.border, borderRadius: radii.card },
            ]}
          >
            <ScrollView horizontal>
              <View accessibilityLabel="File preview">
                {String(contentsData.file.content || '').split('\n').slice(0, 500).map((line, index) => (
                  <View key={index} style={styles.previewLine}>
                    <Text style={[typography.mono, styles.lineNumber, { color: colors.textSecondary }]}>{index + 1}</Text>
                    <Text style={[typography.mono, { color: colors.codeText }]}>{line || ' '}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
            {String(contentsData.file.content || '').split('\n').length > 500 ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Preview limited to the first 500 lines. Open the editor to view the full file.</Text> : null}
          </View>
        </>
      ) : null}
      </> : null}

      <Modal visible={fileDetails} transparent animationType="slide" onRequestClose={() => setFileDetails(false)}><View style={styles.modalBackdrop}><View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[typography.title, { color: colors.textPrimary }]}>File details</Text>{contentsData?.file ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>{`Repository: ${repo.fullName}\nPath: ${contentsData.file.path}\nBranch: ${activeBranch}\nSize: ${contentsData.file.size} bytes\nRevision: ${contentsData.file.sha}`}</Text> : null}<SecondaryButton label="Close" onPress={() => setFileDetails(false)} style={{ marginTop: 16 }} /></View></View></Modal>

      {/* Branch Selector & Create Branch Modal (RP-03, GT-01, GT-02) */}
      <Modal visible={branchModal} transparent animationType="slide" onRequestClose={() => setBranchModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>{branchMode === 'select' ? 'Select branch' : 'Create branch'}</Text>
            {branchMode === 'select' ? <>
            {branchesQuery.isLoading ? <LoadingState message="Loading branches…" /> : null}
            {branchesQuery.error ? <ErrorState message={branchesQuery.error.message} onRetry={branchesQuery.refetch} /> : null}
            <ScrollView style={{ maxHeight: 220, marginTop: 10 }}>
              {(branchesQuery.data?.branches || []).map((b) => (
                <Pressable
                  key={b.name}
                  onPress={() => {
                    setBranch(b.name);
                    setCurrentPath('');
                    setBranchModal(false);
                  }}
                  style={[styles.branchItem, { borderColor: colors.border, borderRadius: radii.pill }]}
                >
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{b.name}</Text>
                  {b.name === activeBranch ? <StatusBadge status="verified" label="Current" /> : null}
                </Pressable>
              ))}
            </ScrollView>
            <SecondaryButton label="Create branch" onPress={() => setBranchMode('create')} style={{ marginTop: 8 }} />
            </> : <>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 14 }]}>
              CREATE FIX BRANCH FROM {activeBranch}
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
            {createBranchMutation.error ? <ErrorState message={createBranchMutation.error.message} /> : null}
            <SecondaryButton label="Back to branches" disabled={createBranchMutation.isPending} onPress={() => setBranchMode('select')} style={{ marginTop: 8 }} />
            </>}
            <SecondaryButton label="Close" onPress={() => setBranchModal(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  section: { borderWidth: 1, minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' },
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
  previewLine: { flexDirection: 'row', alignItems: 'flex-start' },
  lineNumber: { minWidth: 38, textAlign: 'right', paddingRight: 12 },
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
