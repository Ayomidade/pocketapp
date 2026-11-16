import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { colors, typography, radii } = useTheme();
  const [tab, setTab] = useState('deploys'); // 'deploys' | 'logs' | 'health'
  const [logType, setLogType] = useState('app'); // 'app' | 'build'
  const [logQuery, setLogQuery] = useState('');
  const [redeployModal, setRedeployModal] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['service', id],
    queryFn: () => apiRequest(`/services/${id}`),
  });

  const { data: logsData, isFetching: logsFetching, refetch: refetchLogs } = useQuery({
    queryKey: ['service-logs', id, logType, logQuery],
    queryFn: () => apiRequest(`/services/${id}/logs?type=${logType}&q=${encodeURIComponent(logQuery)}`),
    enabled: tab === 'logs',
  });

  const healthMutation = useMutation({
    mutationFn: () => apiRequest(`/services/${id}/health-check`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service', id] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const redeployMutation = useMutation({
    mutationFn: (clearCache) =>
      apiRequest(`/services/${id}/redeploy`, {
        method: 'POST',
        idempotent: true,
        body: { confirmProduction: true, clearCache },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service', id] });
      setRedeployModal(false);
    },
  });

  if (isLoading) {
    return (
      <ScreenContainer>
        <ModuleHeader code="SV" title="Service" showBack />
        <LoadingState />
      </ScreenContainer>
    );
  }

  if (error || !data?.service) {
    return (
      <ScreenContainer>
        <ModuleHeader code="SV" title="Service" showBack />
        <ErrorState message={error?.message} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  const { service, deployments = [], healthChecks = [] } = data;

  return (
    <ScreenContainer>
      <ModuleHeader
        code="SV"
        title={service.name}
        subtitle={`${service.serviceType} · ${service.serviceUrl || 'No public URL'}`}
        showBack
      />

      <SignalBanner>
        <View style={styles.rowBetween}>
          <StatusBadge status={service.effectiveHealthStatus || service.lastHealthStatus} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {service.lastLatencyMs ? `${service.lastLatencyMs}ms` : 'No latency sample'}
          </Text>
        </View>
        <View style={styles.actionRow}>
          <PrimaryButton
            label="Run Health Check"
            loading={healthMutation.isPending}
            onPress={() => healthMutation.mutate()}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="Redeploy (SV-08)"
            onPress={() => setRedeployModal(true)}
            style={{ flex: 1 }}
          />
        </View>
      </SignalBanner>

      {/* Sub-navigation: Deploys / Logs / Health */}
      <View style={[styles.segmentRow, { backgroundColor: colors.bannerMuted, borderRadius: radii.button }]}>
        {[
          { key: 'deploys', label: 'Deploys' },
          { key: 'logs', label: 'Logs' },
          { key: 'health', label: 'Health' },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            style={[
              styles.segmentBtn,
              tab === item.key && { backgroundColor: colors.surface, borderRadius: radii.pill },
            ]}
          >
            <Text style={[typography.bodyBold, { color: tab === item.key ? colors.primary : colors.textSecondary }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* SV-03 / SV-04 Deployments */}
      {tab === 'deploys'
        ? deployments.map((dep) => (
            <SignalCard key={dep.id}>
              <View style={styles.rowBetween}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {dep.commitSha?.slice(0, 7) || dep.renderDeployId.slice(0, 10)}
                </Text>
                <StatusBadge status={dep.status} />
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {dep.commitMessage || `Triggered via ${dep.triggerSource}`}
              </Text>
            </SignalCard>
          ))
        : null}

      {/* SV-05 / SV-06 / SV-07 Build & Runtime Logs */}
      {tab === 'logs' ? (
        <View>
          <View style={styles.actionRow}>
            <SecondaryButton
              label="Runtime Logs (SV-06)"
              onPress={() => setLogType('app')}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label="Build Logs (SV-05)"
              onPress={() => setLogType('build')}
              style={{ flex: 1 }}
            />
          </View>
          <TextInput
            value={logQuery}
            onChangeText={setLogQuery}
            onSubmitEditing={() => refetchLogs()}
            placeholder="Filter log lines (SV-07)..."
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.button },
            ]}
          />
          {logsFetching ? <LoadingState message="Fetching Render logs..." /> : null}
          <View style={[styles.logTerminal, { backgroundColor: colors.codeSurface, borderRadius: radii.card }]}>
            <ScrollView horizontal>
              <View>
                {(logsData?.logs || []).length === 0 ? (
                  <Text style={[typography.mono, { color: colors.textSecondary }]}>
                    No log lines returned for current filter.
                  </Text>
                ) : (
                  logsData.logs.map((entry) => (
                    <Text key={entry.id} style={[typography.mono, { color: colors.codeText, marginBottom: 4 }]}>
                      [{entry.level}] {entry.message}
                    </Text>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}

      {/* SV-11 / SV-12 Health Check History */}
      {tab === 'health'
        ? healthChecks.map((hc) => (
            <SignalCard key={hc.id}>
              <View style={styles.rowBetween}>
                <StatusBadge status={hc.status} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {hc.statusCode ? `HTTP ${hc.statusCode}` : 'No HTTP'} · {hc.latencyMs || 0}ms
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {hc.errorMessage || `Source: ${hc.source}`} · {new Date(hc.checkedAt).toLocaleString()}
              </Text>
            </SignalCard>
          ))
        : null}

      {/* SV-08 Explicit Redeploy Confirmation Modal */}
      <Modal visible={redeployModal} transparent animationType="slide" onRequestClose={() => setRedeployModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <StatusBadge status="warning" label="Production Action" />
            <Text style={[typography.title, { color: colors.textPrimary, marginTop: 8 }]}>
              Confirm Redeployment
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
              Triggering a Render redeploy for {service.name} is an auditable production operation. Completion of a deploy will trigger a fresh health probe, not auto-resolve incidents.
            </Text>
            <PrimaryButton
              label="Redeploy Latest Commit"
              loading={redeployMutation.isPending}
              onPress={() => redeployMutation.mutate(false)}
              style={{ marginTop: 14 }}
            />
            <SecondaryButton
              label="Clear Build Cache & Redeploy"
              onPress={() => redeployMutation.mutate(true)}
              style={{ marginTop: 8 }}
            />
            <SecondaryButton label="Cancel" onPress={() => setRedeployModal(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  segmentRow: { flexDirection: 'row', padding: 4, marginBottom: 14 },
  segmentBtn: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 10, marginBottom: 10, fontSize: 15 },
  logTerminal: { padding: 14, minHeight: 240 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
});
