import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { ModuleHeader } from '../src/components/ModuleHeader';
import { SignalCard, SignalIntro } from '../src/components/SignalCard';
import { StatusBadge } from '../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../src/components/StateViews';
import { useTheme } from '../src/theme/ThemeProvider';
import { apiRequest } from '../src/services/apiClient';

export default function GlobalSearchScreen() {
  const router = useRouter();
  const { colors, typography, radii } = useTheme();
  const [query, setQuery] = useState('');

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => apiRequest(`/ops/search?q=${encodeURIComponent(query.trim())}`),
    enabled: query.trim().length >= 2,
  });

  const projects = data?.projects || [];
  const repositories = data?.repositories || [];
  const services = data?.services || [];
  const incidents = data?.incidents || [];
  const hasResults =
    projects.length + repositories.length + services.length + incidents.length > 0;

  return (
    <ScreenContainer>
      <ModuleHeader
        code="HM"
        title="Global search"
        showBack
      />

      <SignalIntro eyebrow="Search" title="Search your workspace" description="Find projects, repositories, services, and incidents you can access." />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Type at least 2 characters..."
        placeholderTextColor={colors.textSecondary}
        autoFocus
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.button,
          },
        ]}
      />

      {isFetching ? <LoadingState message="Searching PocketOps..." /> : null}
      {!isFetching && error ? <ErrorState message={error.message} onRetry={refetch} /> : null}
      {query.trim().length < 2 ? <EmptyState icon="search-outline" title="Search your workspace" description="Enter at least two characters to find projects, repositories, services, and incidents." /> : null}

      {!isFetching && !error && query.trim().length >= 2 && !hasResults ? (
        <EmptyState
          icon="search-outline"
          title="No Matching Resources"
          description={`Nothing matched "${query.trim()}" across your connected projects, repositories, services, or incidents.`}
        />
      ) : null}

      {incidents.map((inc) => (
        <SignalCard key={inc.id} onPress={() => router.push(`/incidents/${inc.id}`)}>
          <View style={styles.rowBetween}>
            <StatusBadge status={inc.severity} label={`Incident · ${inc.severity}`} />
            <StatusBadge status={inc.status} />
          </View>
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6 }]}>
            {inc.title}
          </Text>
        </SignalCard>
      ))}

      {services.map((svc) => (
        <SignalCard key={svc.id} onPress={() => router.push(`/services/${svc.id}`)}>
          <View style={styles.rowBetween}>
            <StatusBadge status={svc.lastHealthStatus} label="Service" />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{svc.branch}</Text>
          </View>
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6 }]}>
            {svc.name}
          </Text>
        </SignalCard>
      ))}

      {repositories.map((repo) => (
        <SignalCard key={repo.id} onPress={() => router.push(`/repositories/${repo.id}`)}>
          <StatusBadge status="info" label="Repository" />
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6 }]}>
            {repo.fullName}
          </Text>
        </SignalCard>
      ))}

      {projects.map((proj) => (
        <SignalCard key={proj.id} onPress={() => router.push(`/projects/${proj.id}`)}>
          <StatusBadge status="info" label={`Project · ${proj.environment}`} />
          <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6 }]}>
            {proj.name}
          </Text>
        </SignalCard>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    marginBottom: 14,
    fontSize: 15,
  },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' },
});
