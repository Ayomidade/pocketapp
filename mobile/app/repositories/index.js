import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalCard } from '../../src/components/SignalCard';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function RepositoriesLibraryScreen() {
  const router = useRouter();
  const { colors, typography, radii } = useTheme();
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['repositories', search],
    queryFn: () => apiRequest(`/repositories?q=${encodeURIComponent(search.trim())}`),
  });

  return (
    <ScreenContainer>
      <ModuleHeader
        code="RP"
        title="Authorized Repositories"
        subtitle="GitHub App authorized repositories ready for mobile browsing and safe edits"
        showBack
      />

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Filter repositories by owner/name..."
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.button },
        ]}
      />

      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}

      {!isLoading && !error && (data?.repositories || []).length === 0 ? (
        <EmptyState
          icon="git-branch-outline"
          title="No Authorized Repositories"
          description="Install and verify the PocketOps GitHub App in Settings to grant access to specific repositories."
          actionLabel="Open Connections"
          onAction={() => router.push('/settings')}
        />
      ) : (
        (data?.repositories || []).map((repo) => (
          <SignalCard key={repo.id} onPress={() => router.push(`/repositories/${repo.id}`)}>
            <View style={styles.rowBetween}>
              <Text style={[typography.heading, { color: colors.textPrimary, flex: 1 }]}>
                {repo.fullName}
              </Text>
              <StatusBadge
                status={repo.isPrivate ? 'warning' : 'info'}
                label={repo.isPrivate ? 'Private' : 'Public'}
              />
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>
              Branch: {repo.defaultBranch} · {repo.language || 'Source'}
            </Text>
          </SignalCard>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginBottom: 14, fontSize: 15 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
