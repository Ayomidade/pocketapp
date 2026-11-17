import React from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { apiRequest } from '../../src/services/apiClient';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function PullRequestScreen() {
  const { id, number, repo } = useLocalSearchParams();
  const { colors, typography } = useTheme();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['pull-request', id, number],
    queryFn: () => apiRequest(`/repositories/${encodeURIComponent(id)}/pulls/${encodeURIComponent(number)}`),
    enabled: Boolean(id && number),
  });
  const pr = data?.pullRequest;
  return <ScreenContainer>
    <ModuleHeader title={`Pull request #${number || ''}`} subtitle={repo || 'Repository'} showBack />
    {isLoading ? <LoadingState message="Loading pull request…" /> : null}
    {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}
    {pr ? <>
      <SignalBanner><StatusBadge status={pr.merged ? 'verified' : 'info'} label={pr.merged ? 'Merged' : pr.state} /><Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>{pr.title}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>{pr.head} → {pr.base}</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>Revision {pr.headSha?.slice(0, 12) || 'Unavailable'}</Text></SignalBanner>
      {pr.body ? <SignalCard><Text style={[typography.body, { color: colors.textPrimary }]}>{pr.body}</Text></SignalCard> : null}
      <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>CI and checks</Text>
      {pr.checksUnavailable ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>Checks could not be loaded. Verify the GitHub App has permission to read checks and retry.</Text></SignalCard> : null}
      {!pr.checksUnavailable && !pr.checks?.length ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No checks reported for this revision.</Text></SignalCard> : null}
      {(pr.checks || []).map((check) => <SignalCard key={check.id}><View><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{check.name}</Text><Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>{check.conclusion || check.status || 'Unknown'}</Text>{check.completedAt ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>Completed {new Date(check.completedAt).toLocaleString()}</Text> : null}</View></SignalCard>)}
      <SecondaryButton label={isFetching ? 'Refreshing…' : 'Refresh pull request'} disabled={isFetching} onPress={refetch} />
    </> : null}
  </ScreenContainer>;
}
