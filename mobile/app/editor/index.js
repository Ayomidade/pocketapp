import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
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
  const { colors, typography, radii } = useTheme();
  const user = useAuthStore((s) => s.user);
  const activeFile = useAppStore((s) => s.activeEditorFile);
  const setActiveEditorFile = useAppStore((s) => s.setActiveEditorFile);

  const editorRef = useRef(null);
  const [content, setContent] = useState(activeFile?.content || '');
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [drafts, setDrafts] = useState([]);
  const [restoredDraft, setRestoredDraft] = useState(false);

  // Modals covering ED-03, ED-05, ED-06, ED-07, GT-03..GT-07
  const [mode, setMode] = useState('editor'); // 'editor' | 'diff' | 'drafts' | 'commit' | 'pr' | 'conflict'
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [gotoLineInput, setGotoLineInput] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBase, setPrBase] = useState('main');
  const [conflictData, setConflictData] = useState(null);
  const [gitResult, setGitResult] = useState(null);

  const userId = user?.id || 'local-user';

  useEffect(() => {
    (async () => {
      const list = await listEncryptedDrafts(userId).catch(() => []);
      setDrafts(list);
      if (activeFile) {
        const existing = await getEncryptedDraft(
          userId,
          activeFile.repoId,
          activeFile.branch,
          activeFile.path
        ).catch(() => null);
        if (existing && existing.content !== activeFile.originalContent) {
          setContent(existing.content);
          setRestoredDraft(true);
        } else {
          setContent(activeFile.content || '');
          setRestoredDraft(false);
        }
      }
    })();
  }, [activeFile?.repoId, activeFile?.branch, activeFile?.path]);

  const isDirty = Boolean(activeFile && content !== activeFile.originalContent);

  const diffLines = useMemo(
    () => computeLineDiff(activeFile?.originalContent || '', content),
    [activeFile?.originalContent, content]
  );
  const diffStats = useMemo(() => summarizeDiff(diffLines), [diffLines]);

  const handleSaveDraft = async () => {
    if (!activeFile) return;
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
      const existing = await getEncryptedDraft(userId, activeFile.repoId, activeFile.branch, activeFile.path);
      if (existing) await deleteEncryptedDraft(existing.id);
      setMode('pr');
      setPrTitle(commitMessage.trim());
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
          body: `Created from PocketOps mobile editor (${activeFile.path})`,
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
          title="Encrypted Draft Manager (ED-05)"
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
            <SignalCard
              key={d.id}
              onPress={() => {
                setActiveEditorFile({
                  repoId: d.repoId,
                  repoFullName: d.repoFullName,
                  branch: d.branch,
                  path: d.filePath,
                  baseSha: d.baseSha,
                  content: d.content,
                  originalContent: d.content,
                });
                setMode('editor');
              }}
            >
              <View style={styles.rowBetween}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{d.filePath}</Text>
                <StatusBadge status="local_draft" label="Local Draft" />
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {d.repoFullName} · Branch: {d.branch} · Base SHA: {d.baseSha.slice(0, 7)}
              </Text>
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
        title={activeFile.path.split('/').pop()}
        subtitle={`${activeFile.repoFullName} · ${activeFile.branch} · Ln ${cursor.line}, Col ${cursor.col}`}
        showBack
        rightAction={
          <StatusBadge
            status={isDirty ? 'local_draft' : 'verified'}
            label={isDirty ? 'Modified' : restoredDraft ? 'Draft' : 'Clean'}
          />
        }
      />

      {/* Mode Switcher */}
      <View style={styles.toolbarRow}>
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
              onChangeContent={setContent}
              onCursorChange={setCursor}
              editorRef={editorRef}
            />
          </View>
          <PrimaryButton
            label="Review & Commit Changes (GT-03)"
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
            label="Proceed to Commit (GT-03)"
            disabled={!isDirty}
            onPress={() => setMode('commit')}
            style={{ marginTop: 12 }}
          />
        </SignalCard>
      ) : null}

      {/* ED-07 Remote Revision Conflict Reconciliation */}
      {mode === 'conflict' ? (
        <SignalCard style={{ borderColor: colors.critical }}>
          <StatusBadge status="critical" label="Remote SHA Conflict (ED-07)" />
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>
            Remote File Changed Since You Opened It
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
            Expected SHA {conflictData?.expectedSha?.slice(0, 8)} vs Remote SHA {conflictData?.remoteSha?.slice(0, 8)}. Silent overwrite was blocked.
          </Text>
          <PrimaryButton
            label="Accept Remote & Discard Local"
            onPress={() => {
              setContent(conflictData?.remoteContent || '');
              setActiveEditorFile({
                ...activeFile,
                baseSha: conflictData?.remoteSha || activeFile.baseSha,
                content: conflictData?.remoteContent || '',
                originalContent: conflictData?.remoteContent || '',
              });
              setMode('editor');
            }}
            style={{ marginTop: 12 }}
          />
          <SecondaryButton
            label="Rebase Local Draft onto Remote SHA"
            onPress={() => {
              setActiveEditorFile({
                ...activeFile,
                baseSha: conflictData?.remoteSha || activeFile.baseSha,
                originalContent: conflictData?.remoteContent || activeFile.originalContent,
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
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Commit Review (GT-03)</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            Target: {activeFile.branch} · +{diffStats.additions} / -{diffStats.deletions} lines · Base SHA {activeFile.baseSha.slice(0, 7)}
          </Text>
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
            label="Confirm & Push Commit (GT-04)"
            loading={commitMutation.isPending}
            disabled={commitMessage.trim().length < 3}
            onPress={() => commitMutation.mutate()}
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
            Open Pull Request (GT-05)
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
              <PrimaryButton
                label="Create Pull Request"
                loading={prMutation.isPending}
                disabled={prTitle.trim().length < 3}
                onPress={() => prMutation.mutate()}
                style={{ marginTop: 12 }}
              />
            </>
          )}
          <SecondaryButton label="Return to Editor" onPress={() => setMode('editor')} style={{ marginTop: 8 }} />
        </SignalCard>
      ) : null}

      {/* ED-03 Find & Go To Line Modal */}
      <Modal visible={findOpen} transparent animationType="fade" onRequestClose={() => setFindOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.heading, { color: colors.textPrimary }]}>Find & Go to Line (ED-03)</Text>
            <TextInput
              value={findQuery}
              onChangeText={setFindQuery}
              placeholder="Search text in file..."
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceSubtle, borderRadius: radii.button },
              ]}
            />
            <PrimaryButton
              label="Find Next"
              onPress={() => {
                editorRef.current?.find(findQuery);
                setFindOpen(false);
              }}
              style={{ marginTop: 10 }}
            />
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
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  miniBtn: { minHeight: 42, paddingHorizontal: 12 },
  editorContainer: { height: 420 },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 10, fontSize: 15 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderRadius: 16, borderWidth: 1 },
});
