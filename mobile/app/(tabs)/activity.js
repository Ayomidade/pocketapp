import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalCard, SignalIntro } from '../../src/components/SignalCard';
import { SecondaryButton } from '../../src/components/Buttons';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { apiRequest } from '../../src/services/apiClient';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ActivityScreen() {
  const router = useRouter();
  const { colors, typography, radii } = useTheme();
  const [filter, setFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['audit-logs'], queryFn: () => apiRequest('/ops/audit') });
  const resources = [...new Set((data?.auditLogs || []).map((entry) => entry.resourceType).filter(Boolean))].sort();
  const entries = (data?.auditLogs || []).filter((entry) => (filter === 'all' || entry.outcome === filter) && (resourceFilter === 'all' || entry.resourceType === resourceFilter));
  return (
    <ScreenContainer>
      <ModuleHeader code="AC" title="Activity feed" />
      <SignalIntro eyebrow="Activity" title="Recent activity" description="Review recorded account and operational actions. Notifications are available separately." />
      <SecondaryButton label="Open notifications" onPress={() => router.push('/(tabs)/inbox')} style={{ marginBottom: 16 }} />
      <View style={styles.filters}>
        {['all', 'success', 'denied'].map((value) => (
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, { borderColor: colors.border, borderRadius: radii.pill, backgroundColor: filter === value ? colors.primary : colors.surface }]}>
            <Text style={[typography.caption, { color: filter === value ? colors.onPrimary : colors.textPrimary }]}>{value === 'all' ? 'All' : value === 'success' ? 'Successful' : 'Denied'}</Text>
          </Pressable>
        ))}
      </View>
      {resources.length ? <View style={styles.filters}>
        {['all', ...resources].map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: resourceFilter === value }} onPress={() => setResourceFilter(value)} style={[styles.filter, { borderColor: colors.border, borderRadius: radii.pill, backgroundColor: resourceFilter === value ? colors.bannerMuted : colors.surface }]}><Text style={[typography.caption, { color: colors.textPrimary }]}>{value === 'all' ? 'All resources' : value.replace(/_/g, ' ')}</Text></Pressable>)}
      </View> : null}
      {isLoading ? <LoadingState message="Loading activity..." /> : null}
      {error ? <ErrorState message={error.message} onRetry={refetch} /> : null}
      {!isLoading && !error && entries.length === 0 ? <EmptyState title="No activity" description="Recent audit events will appear here." /> : null}
      {entries.map((entry) => (
        <SignalCard key={entry.id} onPress={() => setSelected(entry)}>
          <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{entry.action.replace(/[._]/g, ' ')}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 5 }]}>{entry.outcome} · {new Date(entry.createdAt).toLocaleString()}</Text>
        </SignalCard>
      ))}
      {entries.length > 0 ? <Text style={[typography.caption, { color: colors.textSecondary }]}>Showing up to 50 recent audit events.</Text> : null}
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.backdrop}><View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {selected ? <>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Activity details</Text>
            <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 12 }]}>{selected.action.replace(/[._]/g, ' ')}</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>Outcome: {selected.outcome}</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>Resource: {selected.resourceType?.replace(/_/g, ' ') || 'Account'}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{new Date(selected.createdAt).toLocaleString()}</Text>
          </> : null}
          <SecondaryButton label="Close" onPress={() => setSelected(null)} style={{ marginTop: 16 }} />
        </View></View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, filter: { paddingHorizontal: 14, minHeight: 44, borderWidth: 1, justifyContent: 'center' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }, sheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 } });
