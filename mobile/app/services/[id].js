import React, { useEffect, useState } from 'react';
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [detail, setDetail] = useState(null);
  const [deploymentResult, setDeploymentResult] = useState(null);

  useEffect(() => {
    if (!detail) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setDetail(null); return true; });
    return () => subscription.remove();
  }, [detail]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['service', id],
    queryFn: () => apiRequest(`/services/${id}`),
  });

  const { data: logsData, error: logsError, isFetching: logsFetching, refetch: refetchLogs } = useQuery({
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['service', id] });
      setDeploymentResult(result.deployment);
      setTab('deploys');
      setRedeployModal(false);
    },
  });

  const deploymentProgress = useQuery({
    queryKey: ['deployment-progress', id, deploymentResult?.id],
    queryFn: () => apiRequest(`/services/${id}/deployments?refresh=true`),
    enabled: Boolean(deploymentResult?.id),
    retry: false,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const deployment = query.state.data?.deployments?.find((item) => item.id === deploymentResult?.id) || deploymentResult;
      return ['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress'].includes(deployment?.status) ? 10000 : false;
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
  const currentDeployment = deploymentProgress.data?.deployments?.find((item) => item.id === deploymentResult?.id) || deploymentResult;
  const displayedDeployments = deploymentProgress.data?.deployments || deployments;
  const deploymentRunning = ['created', 'queued', 'build_in_progress', 'update_in_progress', 'pre_deploy_in_progress'].includes(currentDeployment?.status);

  if (detail) {
    const value = detail.value;
    return <ScreenContainer>
      <ModuleHeader title={detail.kind === 'deployment' ? 'Deployment details' : 'Health check details'} subtitle={service.name} />
      <SignalBanner><StatusBadge status={value.status} /><Text style={[typography.heading, { color: colors.textPrimary, marginTop: 10 }]}>{detail.kind === 'deployment' ? `Deployment ${value.commitSha?.slice(0, 7) || value.renderDeployId?.slice(0, 10) || ''}` : 'Health check evidence'}</Text></SignalBanner>
      <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>{detail.kind === 'deployment'
        ? `Source: ${value.triggerSource || 'Unknown'}\nBranch: ${value.branch || 'Unavailable'}\nCommit: ${value.commitSha || 'Unavailable'}\nStarted: ${value.startedAt ? new Date(value.startedAt).toLocaleString() : 'Unknown'}\nFinished: ${value.finishedAt ? new Date(value.finishedAt).toLocaleString() : 'In progress or unavailable'}`
        : `Checked: ${value.checkedAt ? new Date(value.checkedAt).toLocaleString() : 'Unknown'}\nSource: ${value.source || 'Unknown'}\nHTTP status: ${value.statusCode || 'Unavailable'}\nLatency: ${value.latencyMs == null ? 'Unavailable' : `${value.latencyMs} ms`}${value.errorMessage ? `\nDetails: ${value.errorMessage}` : ''}`}</Text></SignalCard>
      {detail.kind === 'deployment' ? <SecondaryButton label="Track this deployment" onPress={() => { setDeploymentResult(value); setDetail(null); }} style={{ marginBottom: 8 }} /> : null}
      <SecondaryButton label="Back to service" onPress={() => setDetail(null)} />
    </ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ModuleHeader
        code="SV"
        title={service.name}
        subtitle={`${service.serviceType} · ${service.serviceUrl || 'No public URL'}`}
        showBack
      />

      <SignalBanner>
        <Text style={[typography.badge, { color: colors.primary, marginBottom: 6 }]}>RENDER</Text>
        <Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>Service overview</Text>
        <View style={styles.rowBetween}>
          <StatusBadge status={service.effectiveHealthStatus || service.lastHealthStatus} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {service.lastLatencyMs ? `${service.lastLatencyMs}ms` : 'No latency sample'}
          </Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>
          {service.lastHealthCheckedAt ? `Last checked ${new Date(service.lastHealthCheckedAt).toLocaleString()}` : 'Health has not been checked yet.'}
        </Text>
        <View style={styles.actionRow}>
          <PrimaryButton
            label="Run Health Check"
            loading={healthMutation.isPending}
            onPress={() => healthMutation.mutate()}
            style={{ flex: 1 }}
          />
          <SecondaryButton
            label="Redeploy"
            onPress={() => setRedeployModal(true)}
            style={{ flex: 1 }}
          />
        </View>
      </SignalBanner>
      {healthMutation.error ? <ErrorState title="Health check failed" message={healthMutation.error.message} onRetry={() => healthMutation.mutate()} /> : null}

      {currentDeployment ? <SignalCard>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>{deploymentRunning ? 'Deployment in progress' : 'Deployment result'}</Text>
        <View style={{ marginTop: 8 }}><StatusBadge status={currentDeployment.status} /></View>
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Deployment status and service health are separate. Run a health check to verify recovery.</Text>
        {deploymentRunning && !deploymentProgress.error ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>Checking for updates every 10 seconds while this screen is open.</Text> : null}
        {deploymentProgress.error ? <Text style={[typography.caption, { color: colors.critical, marginTop: 8 }]}>Status could not be refreshed: {deploymentProgress.error.message}</Text> : null}
        <SecondaryButton label={deploymentProgress.isFetching ? 'Refreshing…' : 'Refresh deployment status'} disabled={deploymentProgress.isFetching} onPress={() => deploymentProgress.refetch()} style={{ marginTop: 10 }} />
      </SignalCard> : null}

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
      {tab === 'deploys' && !currentDeployment ? <>
        <SecondaryButton label={deploymentProgress.isFetching ? 'Refreshing…' : 'Refresh deployment history'} disabled={deploymentProgress.isFetching} onPress={() => deploymentProgress.refetch()} style={{ marginBottom: 12 }} />
        {deploymentProgress.error ? <ErrorState message={deploymentProgress.error.message} onRetry={() => deploymentProgress.refetch()} /> : null}
      </> : null}
      {tab === 'deploys'
        ? displayedDeployments.map((dep) => (
            <SignalCard key={dep.id} onPress={() => setDetail({ kind: 'deployment', value: dep })}>
              <View style={styles.rowBetween}>
                <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                  {dep.commitSha?.slice(0, 7) || dep.renderDeployId?.slice(0, 10) || 'Unknown revision'}
                </Text>
                <StatusBadge status={dep.status} />
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {dep.commitMessage || `Triggered via ${dep.triggerSource}`}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{dep.startedAt ? `Started ${new Date(dep.startedAt).toLocaleString()}` : 'Start time unavailable'}</Text>
            </SignalCard>
          ))
        : null}
      {tab === 'deploys' && displayedDeployments.length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No deployments recorded yet.</Text></SignalCard> : null}

      {/* SV-05 / SV-06 / SV-07 Build & Runtime Logs */}
      {tab === 'logs' ? (
        <View>
          <View style={styles.actionRow}>
            <SecondaryButton
              label="Runtime Logs"
              onPress={() => setLogType('app')}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label="Build Logs"
              onPress={() => setLogType('build')}
              style={{ flex: 1 }}
            />
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12 }]}>{logType === 'app' ? 'Runtime logs' : 'Build logs'}</Text>
          <TextInput
            value={logQuery}
            onChangeText={setLogQuery}
            onSubmitEditing={() => refetchLogs()}
            placeholder="Filter log lines..."
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.button },
            ]}
          />
          {logsFetching ? <LoadingState message="Fetching Render logs..." /> : null}
          {logsError ? <ErrorState message={logsError.message} onRetry={refetchLogs} /> : null}
          <View style={[styles.logTerminal, { backgroundColor: colors.codeSurface, borderRadius: radii.card }]}>
            <ScrollView horizontal>
              <View>
                {(logsData?.logs || []).length === 0 ? (
                  <Text style={[typography.mono, { color: colors.textSecondary }]}>
                    {logsError ? 'Logs are unavailable.' : logsFetching ? 'Loading logs…' : 'No log lines returned for current filter.'}
                  </Text>
                ) : (
                  logsData.logs.map((entry) => (
                    <Text key={entry.id} style={[typography.mono, { color: colors.codeText, marginBottom: 4 }]}>
                      [{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Time unavailable'}] [{entry.level}] {entry.message}
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
            <SignalCard key={hc.id} onPress={() => setDetail({ kind: 'health', value: hc })}>
              <View style={styles.rowBetween}>
                <StatusBadge status={hc.status} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {hc.statusCode ? `HTTP ${hc.statusCode}` : 'No HTTP'} · {hc.latencyMs == null ? 'Latency unavailable' : `${hc.latencyMs}ms`}
                </Text>
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                {hc.errorMessage || `Source: ${hc.source}`} · {new Date(hc.checkedAt).toLocaleString()}
              </Text>
            </SignalCard>
          ))
        : null}
      {tab === 'health' && healthChecks.length === 0 ? <SignalCard><Text style={[typography.body, { color: colors.textSecondary }]}>No health checks recorded yet.</Text></SignalCard> : null}

      {/* SV-08 Explicit Redeploy Confirmation Modal */}
      <Modal visible={redeployModal} transparent animationType="slide" onRequestClose={() => setRedeployModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <StatusBadge status="warning" label="Production Action" />
            <Text style={[typography.title, { color: colors.textPrimary, marginTop: 8 }]}>
              Confirm Redeployment
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6 }]}>
              Triggering a Render redeploy for {service.name} is an auditable production operation. Check service health separately after the deployment.
            </Text>
            {redeployMutation.error ? <Text style={[typography.caption, { color: colors.critical, marginTop: 8 }]}>{redeployMutation.error.message}</Text> : null}
            <PrimaryButton
              label="Redeploy Latest Commit"
              loading={redeployMutation.isPending}
              onPress={() => redeployMutation.mutate(false)}
              style={{ marginTop: 14 }}
            />
            <SecondaryButton
              label="Clear Build Cache & Redeploy"
              disabled={redeployMutation.isPending}
              onPress={() => redeployMutation.mutate(true)}
              style={{ marginTop: 8 }}
            />
            <SecondaryButton label="Cancel" disabled={redeployMutation.isPending} onPress={() => setRedeployModal(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, marginBottom: 14 },
  segmentBtn: { flex: 1, minWidth: 80, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, minHeight: 48, paddingHorizontal: 14, marginTop: 10, marginBottom: 10, fontSize: 15 },
  logTerminal: { padding: 14, minHeight: 240 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1 },
});
