import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard, SignalIntro } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState } from '../../src/components/StateViews';
import { CodeMirrorEditor } from '../../src/features/editor/CodeMirrorEditor';
import { computeLineDiff, summarizeDiff } from '../../src/features/editor/diffUtils';
import {
  deleteEncryptedDraft,
  getEncryptedDraft,
  listEncryptedDrafts,
  saveEncryptedDraft,
} from '../../src/security/draftStore';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useAppStore } from '../../src/store/useAppStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function CodeEditorWorkspaceScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, typography, radii } = useTheme();
  const user = useAuthStore((s) => s.user);
  const activeFile = useAppStore((s) => s.activeEditorFile);
  const setActiveEditorFile = useAppStore((s) => s.setActiveEditorFile);

  const editorRef = useRef(null);
  const allowNavigation = useRef(false);
  const [content, setContent] = useState(activeFile?.content || '');
  const contentRef = useRef(activeFile?.content || '');
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [drafts, setDrafts] = useState([]);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [draftNotice, setDraftNotice] = useState('');

  // Modals covering ED-03, ED-05, ED-06, ED-07, GT-03..GT-07
  const [mode, setMode] = useState('editor'); // 'editor' | 'diff' | 'drafts' | 'commit' | 'pr' | 'conflict'
  const [findOpen, setFindOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchPath, setSwitchPath] = useState('');
  const [findQuery, setFindQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [gotoLineInput, setGotoLineInput] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prBase, setPrBase] = useState('main');
  const [conflictData, setConflictData] = useState(null);
  const [gitResult, setGitResult] = useState(null);
  const [showChecks, setShowChecks] = useState(false);

  const pullRequest = useQuery({
    queryKey: ['pull-request', activeFile?.repoId, gitResult?.data?.number],
    queryFn: () => apiRequest(`/repositories/${activeFile.repoId}/pulls/${gitResult.data.number}`),
    enabled: showChecks && gitResult?.kind === 'pr' && Boolean(activeFile?.repoId && gitResult?.data?.number),
  });
  const switchContents = useQuery({
    queryKey: ['editor-switcher', activeFile?.repoId, activeFile?.branch, switchPath],
    queryFn: () => apiRequest(`/repositories/${activeFile.repoId}/contents?path=${encodeURIComponent(switchPath)}&ref=${encodeURIComponent(activeFile.branch)}`),
    enabled: switchOpen && Boolean(activeFile?.repoId && activeFile?.branch),
  });

  const userId = user?.id || 'local-user';

  useEffect(() => {
    let cancelled = false;
    const initialContent = activeFile?.content || '';
    contentRef.current = initialContent;
    if (activeFile) setContent(initialContent);
    (async () => {
      const list = await listEncryptedDrafts(userId).catch(() => []);
      if (cancelled) return;
      setDrafts(list);
      if (activeFile) {
        const existing = await getEncryptedDraft(
          userId,
          activeFile.repoId,
          activeFile.branch,
          activeFile.path
        ).catch(() => null);
        if (cancelled || contentRef.current !== initialContent) return;
        if (existing && existing.content !== activeFile.originalContent) {
          contentRef.current = existing.content;
          setContent(existing.content);
          setRestoredDraft(true);
        } else {
          setContent(activeFile.content || '');
          setRestoredDraft(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeFile?.repoId, activeFile?.branch, activeFile?.path]);

  const isDirty = Boolean(activeFile && content !== activeFile.originalContent);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowNavigation.current) { allowNavigation.current = false; return; }
    if (!isDirty) return;
    event.preventDefault();
    Alert.alert('Unsaved changes', 'Save a draft before leaving?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { allowNavigation.current = true; navigation.dispatch(event.data.action); } },
      { text: 'Save draft', onPress: async () => {
        try {
          await saveEncryptedDraft({ userId, repoId: activeFile.repoId, repoFullName: activeFile.repoFullName, branch: activeFile.branch, filePath: activeFile.path, baseSha: activeFile.baseSha, content });
          allowNavigation.current = true;
          navigation.dispatch(event.data.action);
        } catch (error) {
          Alert.alert('Could not save draft', error.message || 'Please try again.');
        }
      } },
    ]);
  }), [navigation, isDirty, activeFile, content, userId]);

  const diffLines = useMemo(
    () => computeLineDiff(activeFile?.originalContent || '', content),
    [activeFile?.originalContent, content]
  );
  const diffStats = useMemo(() => summarizeDiff(diffLines), [diffLines]);

  const handleSaveDraft = async () => {
    if (!activeFile) return;
    try {
      await saveEncryptedDraft({
        userId,
        repoId: activeFile.repoId,
        repoFullName: activeFile.repoFullName,
        branch: activeFile.branch,
        filePath: activeFile.path,
        baseSha: activeFile.baseSha,
        content,
      });
      const list = await listEncryptedDrafts(userId);
      setDrafts(list);
      setRestoredDraft(true);
      Alert.alert('Encrypted Draft Saved', 'Stored locally in SQLite encrypted with SecureStore key.');
    } catch (error) {
      Alert.alert('Could not save draft', error.message || 'Please try again.');
    }
  };

  const loadDraft = async (draft) => {
    let originalContent = null;
    let notice = 'The remote file is unavailable. Review the draft against the remote file when you reconnect.';
    try {
      const response = await apiRequest(`/repositories/${draft.repoId}/contents?path=${encodeURIComponent(draft.filePath)}&ref=${encodeURIComponent(draft.branch)}`);
      if (response.kind === 'file' && typeof response.file.content === 'string') {
        originalContent = response.file.content;
        notice = response.file.sha === draft.baseSha ? '' : 'The remote file changed since this draft was saved. Review both versions before committing.';
      }
    } catch { /* Allow a draft to open while offline. */ }
    setDraftNotice(notice);
    setActiveEditorFile({ repoId: draft.repoId, repoFullName: draft.repoFullName, branch: draft.branch, path: draft.filePath, baseSha: draft.baseSha, content: draft.content, originalContent });
    setContent(draft.content);
    setRestoredDraft(true);
    setMode('editor');
  };

  const openDraft = (draft) => {
    if (!isDirty) { loadDraft(draft); return; }
    Alert.alert('Unsaved changes', 'Save your current changes before opening another draft?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard changes', style: 'destructive', onPress: () => loadDraft(draft) },
      { text: 'Save draft', onPress: async () => {
        try {
          await saveEncryptedDraft({ userId, repoId: activeFile.repoId, repoFullName: activeFile.repoFullName, branch: activeFile.branch, filePath: activeFile.path, baseSha: activeFile.baseSha, content });
          await loadDraft(draft);
        } catch (error) { Alert.alert('Could not save draft', error.message || 'Please try again.'); }
      } },
    ]);
  };

  const switchFile = (file) => {
    const apply = () => {
      if (file.editable === false || typeof file.content !== 'string') {
        Alert.alert('Cannot edit file', 'This file is unavailable as text.');
        return;
      }
      setActiveEditorFile({ ...activeFile, path: file.path, baseSha: file.sha, content: file.content, originalContent: file.content });
      setContent(file.content);
      setDraftNotice('');
      setRestoredDraft(false);
      setSwitchOpen(false);
    };
    if (!isDirty) { apply(); return; }
    Alert.alert('Unsaved changes', 'Save your current changes before switching files?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: apply },
      { text: 'Save draft', onPress: async () => {
        try {
          await saveEncryptedDraft({ userId, repoId: activeFile.repoId, repoFullName: activeFile.repoFullName, branch: activeFile.branch, filePath: activeFile.path, baseSha: activeFile.baseSha, content });
          apply();
        } catch (error) { Alert.alert('Could not save draft', error.message || 'Please try again.'); }
      } },
    ]);
  };

  const commitMutation = useMutation({
    mutationFn: (overrideSha) =>
      apiRequest(`/repositories/${activeFile.repoId}/commits`, {
        method: 'POST',
        idempotent: true,
        body: {
          path: activeFile.path,
          branch: activeFile.branch,
          message: commitMessage.trim(),
          content,
          expectedSha: overrideSha ?? activeFile.baseSha,
        },
      }),
    onSuccess: async (res) => {
      setGitResult({ kind: 'commit', data: res.commit });
      setActiveEditorFile({
        ...activeFile,
        baseSha: res.commit.fileSha || activeFile.baseSha,
        content,
        originalContent: content,
      });
      setMode('pr');
      setPrTitle(commitMessage.trim());
      try {
        const existing = await getEncryptedDraft(userId, activeFile.repoId, activeFile.branch, activeFile.path);
        if (existing) await deleteEncryptedDraft(existing.id);
      } catch {
        Alert.alert('Commit pushed', 'Your commit succeeded, but the local draft could not be removed.');
      }
    },
    onError: (err) => {
      if (err.code === 'REMOTE_REVISION_CONFLICT' || err.status === 409) {
        setConflictData(err.details || {});
        setMode('conflict');
      }
    },
  });

  const prMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/repositories/${activeFile.repoId}/pulls`, {
        method: 'POST',
        idempotent: true,
        body: {
          title: prTitle.trim(),
          body: prBody.trim(),
          head: activeFile.branch,
          base: prBase.trim() || 'main',
        },
      }),
    onSuccess: (res) => {
      setGitResult({ kind: 'pr', data: res.pullRequest });
    },
  });

  // If opened without an active file, show ED-05 Draft Manager
  if (!activeFile || mode === 'drafts') {
    return (
      <ScreenContainer>
        <ModuleHeader
          code="ED"
          title="Encrypted Draft Manager"
          subtitle="Offline changes protected by SecureStore-backed encryption"
          showBack
        />
        {drafts.length === 0 ? (
          <EmptyState
            icon="document-lock-outline"
            title="No Encrypted Drafts"
            description="Open any file from a GitHub repository to edit in CodeMirror 6. Drafts are saved locally when offline."
            actionLabel="Browse Repositories"
            onAction={() => router.push('/repositories')}
          />
        ) : (
          drafts.map((d) => (
            <SignalCard key={d.id}>
              <View style={styles.rowBetween}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{d.filePath}</Text>
                <StatusBadge status="local_draft" label="Local Draft" />
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {d.repoFullName} · Branch: {d.branch} · Base SHA: {d.baseSha.slice(0, 7)}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>Saved {new Date(d.updatedAt).toLocaleString()}</Text>
              <SecondaryButton label="Open draft" onPress={() => openDraft(d)} style={{ marginTop: 12 }} />
              <SecondaryButton label="Delete draft" onPress={() => Alert.alert('Delete draft?', 'This removes the local copy of your changes.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await deleteEncryptedDraft(d.id); setDrafts(await listEncryptedDrafts(userId)); } }])} style={{ marginTop: 8 }} />
            </SignalCard>
          ))
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ModuleHeader
        code="ED"
        title={{ editor: 'CodeMirror editor', diff: 'Diff review', conflict: 'Revision conflict', commit: 'Commit review', pr: 'Pull request' }[mode] || activeFile.path.split('/').pop()}
        subtitle={`${activeFile.repoFullName} · ${activeFile.branch} · Ln ${cursor.line}, Col ${cursor.col}`}
        showBack
        rightAction={
          <StatusBadge
            status={isDirty ? 'local_draft' : 'verified'}
            label={isDirty ? 'Modified' : restoredDraft ? 'Draft' : 'Clean'}
          />
        }
      />

      {mode === 'editor' ? <SignalBanner>
        <Text style={[typography.badge, { color: colors.primary }]}>{isDirty ? 'LOCAL CHANGES' : 'EDITOR'}</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>{activeFile.path.split('/').pop()} · Edit</Text>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>{activeFile.repoFullName} · {activeFile.branch} · {isDirty ? 'Uncommitted changes' : 'No local changes'}</Text>
      </SignalBanner> : null}
      {mode === 'diff' ? <SignalIntro eyebrow="Review" title="Review changes" description={`${activeFile.path} · ${activeFile.branch} · +${diffStats.additions} / -${diffStats.deletions}`} /> : null}
      {mode === 'conflict' ? <SignalIntro eyebrow="Verification" title="Remote revision changed" description="Review the latest file and your local changes before choosing what to do." /> : null}
      {mode === 'commit' ? <SignalIntro eyebrow="Review" title="Commit review" description="Confirm the file, branch, changes, and expected revision before committing." /> : null}
      {mode === 'pr' ? <SignalIntro eyebrow="Git" title="Pull request" description="Review the pushed commit and choose the target branch." /> : null}

      {/* Mode Switcher */}
      {draftNotice ? <SignalBanner><Text style={[typography.body, { color: colors.textSecondary }]}>{draftNotice}</Text></SignalBanner> : null}
      <View style={styles.toolbarRow}>
        <SecondaryButton label="Files" onPress={() => { setSwitchPath(''); setSwitchOpen(true); }} style={styles.miniBtn} />
        <SecondaryButton label="Find / Line" onPress={() => setFindOpen(true)} style={styles.miniBtn} />
        <SecondaryButton label="Save Draft" onPress={handleSaveDraft} style={styles.miniBtn} />
        <SecondaryButton
          label={mode === 'diff' ? 'Back to Code' : `Diff (+${diffStats.additions}/-${diffStats.deletions})`}
          onPress={() => setMode(mode === 'diff' ? 'editor' : 'diff')}
          style={styles.miniBtn}
        />
        <SecondaryButton label="Drafts" onPress={() => setMode('drafts')} style={styles.miniBtn} />
      </View>

      {commitMutation.error && mode !== 'conflict' ? (
        <ErrorState title="Commit Error" message={commitMutation.error.message} />
      ) : null}

      {/* ED-01 CodeMirror 6 */}
      {mode === 'editor' ? (
        <>
          <View style={styles.editorContainer}>
            <CodeMirrorEditor
              filePath={activeFile.path}
              content={content}
              onChangeContent={(next) => { contentRef.current = next; setContent(next); }}
              onCursorChange={setCursor}
              onSearchResult={setSearchResult}
              editorRef={editorRef}
            />
          </View>
          <PrimaryButton
            label="Review & Commit Changes"
            disabled={!isDirty}
            onPress={() => setMode('commit')}
            style={{ marginTop: 12 }}
          />
        </>
      ) : null}

      {/* ED-06 Diff Review */}
      {mode === 'diff' ? (
        <SignalCard>
          <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>
            Unified Diff (+{diffStats.additions} / -{diffStats.deletions})
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {diffLines.map((line, idx) => (
              <Text
                key={idx}
                style={[
                  typography.mono,
                  {
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    color:
                      line.type === 'added'
                        ? colors.verified
                        : line.type === 'removed'
                        ? colors.critical
                        : colors.textSecondary,
                    backgroundColor:
                      line.type === 'added'
                        ? colors.verifiedBg
                        : line.type === 'removed'
                        ? colors.criticalBg
                        : 'transparent',
                  },
                ]}
              >
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                {line.text}
              </Text>
            ))}
          </ScrollView>
          <PrimaryButton
            label="Proceed to Commit"
            disabled={!isDirty}
            onPress={() => setMode('commit')}
            style={{ marginTop: 12 }}
          />
        </SignalCard>
      ) : null}

      {/* ED-07 Remote Revision Conflict Reconciliation */}
      {mode === 'conflict' ? (
        <SignalCard style={{ borderColor: colors.critical }}>
          <StatusBadge status="critical" label="Remote SHA Conflict" />
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>
            Remote File Changed Since You Opened It
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
            Expected SHA {conflictData?.expectedSha?.slice(0, 8)} vs Remote SHA {conflictData?.remoteSha?.slice(0, 8)}. Silent overwrite was blocked.
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Review the latest remote content before deciding how to proceed.</Text>
          {typeof conflictData?.remoteContent === 'string' ? <ScrollView style={{ maxHeight: 160, marginTop: 8 }}><Text style={[typography.mono, { color: colors.textPrimary }]}>{conflictData.remoteContent}</Text></ScrollView> : null}
          <PrimaryButton
            label="Accept Remote & Discard Local"
            disabled={!conflictData?.remoteSha || typeof conflictData?.remoteContent !== 'string'}
            onPress={() => {
              setContent(conflictData.remoteContent);
              setActiveEditorFile({
                ...activeFile,
                baseSha: conflictData.remoteSha,
                content: conflictData.remoteContent,
                originalContent: conflictData.remoteContent,
              });
              setMode('editor');
            }}
            style={{ marginTop: 12 }}
          />
          <SecondaryButton
            label="Review my draft against the latest file"
            disabled={!conflictData?.remoteSha || typeof conflictData?.remoteContent !== 'string'}
            onPress={() => {
              setActiveEditorFile({
                ...activeFile,
                baseSha: conflictData.remoteSha,
                originalContent: conflictData.remoteContent,
              });
              setMode('diff');
            }}
            style={{ marginTop: 8 }}
          />
        </SignalCard>
      ) : null}

      {/* GT-03 / GT-04 Commit Review & Confirmation */}
      {mode === 'commit' ? (
        <SignalCard>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Commit Review</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            Target: {activeFile.branch} · +{diffStats.additions} / -{diffStats.deletions} lines · Base SHA {activeFile.baseSha.slice(0, 7)}
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{activeFile.path} · {activeFile.repoFullName}</Text>
          <ScrollView style={{ maxHeight: 180, marginTop: 8 }}>
            {diffLines.map((line, idx) => <Text key={idx} style={[typography.mono, { color: line.type === 'added' ? colors.verified : line.type === 'removed' ? colors.critical : colors.textSecondary }]}>{line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}{line.text}</Text>)}
          </ScrollView>
          <TextInput
            value={commitMessage}
            onChangeText={setCommitMessage}
            placeholder="Commit message (e.g. fix: guard null webhook signature)"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
            ]}
          />
          <PrimaryButton
            label="Confirm & Push Commit"
            loading={commitMutation.isPending}
            disabled={commitMessage.trim().length < 3}
            onPress={() => Alert.alert('Confirm commit', `Commit ${activeFile.path} to ${activeFile.branch}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Commit', onPress: () => commitMutation.mutate() }])}
            style={{ marginTop: 12 }}
          />
          <SecondaryButton label="Back to Diff" onPress={() => setMode('diff')} style={{ marginTop: 8 }} />
        </SignalCard>
      ) : null}

      {/* GT-05 / GT-08 Pull Request Creation & Result */}
      {mode === 'pr' ? (
        <SignalCard>
          <StatusBadge status="verified" label="Commit Pushed (Not Deployed Yet)" />
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>
            Open Pull Request
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            Head: {activeFile.branch} · Commit: {gitResult?.data?.commitSha?.slice(0, 7) || 'pushed'}
          </Text>
          {prMutation.isSuccess && gitResult?.kind === 'pr' ? (
            <SignalBanner style={{ marginTop: 12 }}>
              <Text style={[typography.bodyBold, { color: colors.verified }]}>
                Pull Request #{gitResult.data.number} Opened
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {gitResult.data.head} → {gitResult.data.base} · {gitResult.data.state}
              </Text>
              <SecondaryButton label={showChecks ? 'Hide pull request details' : 'View pull request and checks'} onPress={() => setShowChecks(!showChecks)} style={{ marginTop: 12 }} />
              {showChecks && pullRequest.isLoading ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Loading checks...</Text> : null}
              {showChecks && pullRequest.error ? <ErrorState message={pullRequest.error.message} onRetry={pullRequest.refetch} /> : null}
              {showChecks && pullRequest.data?.pullRequest ? <View style={{ marginTop: 12 }}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{pullRequest.data.pullRequest.title}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{pullRequest.data.pullRequest.head} → {pullRequest.data.pullRequest.base} · {pullRequest.data.pullRequest.merged ? 'Merged' : pullRequest.data.pullRequest.state}</Text>
                {pullRequest.data.pullRequest.checksUnavailable ? <Text style={[typography.caption, { color: colors.warning, marginTop: 8 }]}>Checks unavailable. Verify GitHub App permissions and retry.</Text> : (pullRequest.data.pullRequest.checks || []).length === 0 ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>No checks reported for this revision.</Text> : pullRequest.data.pullRequest.checks.map((check) => <Text key={check.id} style={[typography.body, { color: colors.textPrimary, marginTop: 8 }]}>{check.name}: {check.conclusion || check.status || 'unknown'}</Text>)}
                <SecondaryButton label="Refresh checks" onPress={() => pullRequest.refetch()} style={{ marginTop: 12 }} />
              </View> : null}
            </SignalBanner>
          ) : (
            <>
              <TextInput
                value={prTitle}
                onChangeText={setPrTitle}
                placeholder="Pull request title"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
                ]}
              />
              <TextInput
                value={prBase}
                onChangeText={setPrBase}
                placeholder="Base branch (e.g. main)"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
                ]}
              />
              <TextInput
                value={prBody}
                onChangeText={setPrBody}
                placeholder="Describe the changes (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button }]}
              />
              {prMutation.error ? <ErrorState title="Could not create pull request" message={prMutation.error.message} /> : null}
              {prBase.trim() === activeFile.branch ? <Text style={[typography.caption, { color: colors.warning, marginTop: 8 }]}>Choose a different base branch.</Text> : null}
              <PrimaryButton
                label="Create Pull Request"
                loading={prMutation.isPending}
                disabled={prTitle.trim().length < 3 || !prBase.trim() || prBase.trim() === activeFile.branch}
                onPress={() => Alert.alert('Create pull request?', `${activeFile.branch} → ${prBase.trim()}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Create', onPress: () => prMutation.mutate() }])}
                style={{ marginTop: 12 }}
              />
            </>
          )}
          <SecondaryButton label="Return to Editor" onPress={() => setMode('editor')} style={{ marginTop: 8 }} />
        </SignalCard>
      ) : null}

      {/* ED-03 Find & Go To Line Modal */}
      <Modal visible={switchOpen} transparent animationType="slide" onRequestClose={() => setSwitchOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '85%' }]}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>Switch file</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>{activeFile.repoFullName} · {activeFile.branch} · /{switchPath}</Text>
            {switchPath ? <SecondaryButton label="Parent folder" onPress={() => setSwitchPath(switchPath.split('/').slice(0, -1).join('/'))} style={{ marginTop: 8 }} /> : null}
            {switchContents.isLoading ? <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>Loading files...</Text> : null}
            {switchContents.error ? <ErrorState message={switchContents.error.message} onRetry={switchContents.refetch} /> : null}
            <ScrollView style={{ maxHeight: 350, marginTop: 10 }}>
              {switchContents.data?.kind === 'dir' ? switchContents.data.entries.map((entry) => <SignalCard key={entry.path} onPress={() => setSwitchPath(entry.path)}><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{entry.type === 'dir' ? 'Folder · ' : 'File · '}{entry.name}</Text></SignalCard>) : null}
              {switchContents.data?.kind === 'file' ? <SignalCard><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{switchContents.data.file.name}</Text><PrimaryButton label="Open file" onPress={() => switchFile(switchContents.data.file)} style={{ marginTop: 10 }} /></SignalCard> : null}
            </ScrollView>
            <SecondaryButton label="Close" onPress={() => setSwitchOpen(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
      <Modal visible={findOpen} transparent animationType="fade" onRequestClose={() => setFindOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>Find & Go to Line</Text>
            <TextInput
              value={findQuery}
              onChangeText={(value) => { setFindQuery(value); setSearchResult(null); }}
              placeholder="Search text in file..."
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <PrimaryButton
              label="Find Next"
              disabled={!findQuery}
              onPress={() => {
                editorRef.current?.find(findQuery);
              }}
              style={{ marginTop: 10 }}
            />
            {searchResult ? <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{searchResult.total ? `Match ${searchResult.current} of ${searchResult.total}` : 'No matches found'}</Text> : null}
            <TextInput
              value={gotoLineInput}
              onChangeText={setGotoLineInput}
              placeholder="Line number (e.g. 42)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <SecondaryButton
              label="Go to Line"
              onPress={() => {
                editorRef.current?.goToLine(Number(gotoLineInput || 1));
                setFindOpen(false);
              }}
              style={{ marginTop: 10 }}
            />
            <SecondaryButton label="Close" onPress={() => setFindOpen(false)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  miniBtn: { minHeight: 42, paddingHorizontal: 12 },
  editorContainer: { height: 420 },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 10, fontSize: 15 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderRadius: 16, borderWidth: 1 },
});
