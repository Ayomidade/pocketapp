import React, { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { ModuleHeader } from '../../src/components/ModuleHeader';
import { SignalBanner, SignalCard } from '../../src/components/SignalCard';
import { ContextCard } from '../../src/components/ContextCard';
import { PrimaryButton, SecondaryButton } from '../../src/components/Buttons';
import { StatusBadge } from '../../src/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/StateViews';
import { useTheme } from '../../src/theme/ThemeProvider';
import { apiRequest } from '../../src/services/apiClient';

export default function OperationalDashboardScreen() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest('/ops/dashboard'),
  });

  return <DashboardContent {...query} />;
}

export function DashboardContent({ data, dataUpdatedAt, isLoading, error, refetch, isRefetching, preview = false }) {
  const navigation = useRouter();
  const router = preview ? { push: () => {} } : navigation;
  const { colors, typography, radii } = useTheme();
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);

  if (isLoading) {
    return (
      <ScreenContainer>
        <ModuleHeader code="HM" title="Operations" />
        <LoadingState />
      </ScreenContainer>
    );
  }

  const problems = data?.integrationProblems || [];
  const activeIncidents = data?.activeIncidents || [];
  const services = data?.services || [];
  const deployments = data?.recentDeployments || [];

  return (
    <ScreenContainer scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <ModuleHeader code="HM" title="Operational dashboard" />

        {error ? (
          <ErrorState
            title="Partial or Unavailable Telemetry"
            message={error.message}
            onRetry={refetch}
          />
        ) : null}

        {data ? <SignalBanner style={{ minHeight: 120 }}>
          <Text style={[typography.badge, { color: colors.primary }]}>{activeIncidents.length ? 'ACTIVE INCIDENTS' : 'YOUR WORKSPACE'}</Text>
          <Text style={[typography.title, { color: colors.textPrimary, marginTop: 8 }]}>{activeIncidents.length ? 'Production needs attention' : data.isFirstUse ? 'Set up your workspace' : 'Your operational overview'}</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{activeIncidents.length ? `${activeIncidents.length} active ${activeIncidents.length === 1 ? 'incident' : 'incidents'} to review.` : 'Review incidents, service health, and recent deployments.'}</Text>
        </SignalBanner> : null}

        {data ? <>
          <ContextCard title="Repository context" description={services.find((service) => service.repoFullName)?.repoFullName || 'No linked repository in service data'} />
          <ContextCard title="Operation state" description={deployments.length ? `${deployments.length} recent ${deployments.length === 1 ? 'deployment' : 'deployments'} available` : 'No recent deployment recorded'} />
          <ContextCard title="Verification" description={dataUpdatedAt ? `Dashboard refreshed ${new Date(dataUpdatedAt).toLocaleString()}` : 'Check current provider data before acting'} />
          {activeIncidents.length ? <PrimaryButton label="Investigate incident" align="left" onPress={() => router.push(`/incidents/${activeIncidents[0].id}`)} style={{ marginBottom: 14 }} /> : null}
        </> : null}

        <View style={[styles.headerActions, { marginBottom: 14 }]}>
          <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel="Global search" style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill }]}>
            <Ionicons name="search-outline" size={20} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Account and settings" style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill }]}>
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {problems.length > 0 ? (
          <SignalCard style={{ borderColor: colors.warning, backgroundColor: colors.warningBg }}>
            <Text style={[typography.heading, { color: colors.warning }]}>Integration Attention Required</Text>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: 4 }]}>
              {problems.includes('no_authorized_repositories')
                ? 'Authorize GitHub repositories via the PocketOps GitHub App to browse and edit code.'
                : 'Connect Render to discover services and deployment telemetry.'}
            </Text>
            <SecondaryButton
              label="Manage Connections"
              onPress={() => router.push('/settings')}
              style={{ marginTop: 10 }}
            />
          </SignalCard>
        ) : null}

        {/* HM-01 Summary Banner */}
        {data ? <SignalCard>
          <Text style={[typography.bodyBold, { color: colors.textPrimary, marginBottom: 8 }]}>Current status</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>ACTIVE INCIDENTS</Text>
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: 2 }]}>
                {activeIncidents.length}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>SERVICES</Text>
              <Text style={[typography.title, { color: colors.textPrimary, marginTop: 2 }]}>
                {services.length}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>FAILED DEPLOYS</Text>
              <Text style={[typography.title, { color: colors.critical, marginTop: 2 }]}>
                {(data?.failedDeployments || []).length}
              </Text>
            </View>
          </View>
        </SignalCard> : null}

        {/* First-use state */}
        {data?.isFirstUse ? (
          <EmptyState
            icon="rocket-outline"
            title="Ready for Your First Project"
            description="Link a GitHub repository and a Render service into a PocketOps Project to unlock one-tap incident recovery."
            actionLabel="Open Projects & Repos"
            onAction={() => router.push('/(tabs)/projects')}
          />
        ) : null}

        {/* Active Incidents */}
        {data ? <><Text style={[typography.heading, { color: colors.textPrimary, marginBottom: 8 }]}>
          Active Incidents
        </Text>
        {activeIncidents.length === 0 ? (
          <SignalCard>
            <View style={styles.rowBetween}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>No open incidents</Text>
              <StatusBadge status="verified" label="Clear" />
            </View>
          </SignalCard>
        ) : (
          activeIncidents.map((inc) => (
            <SignalCard
              key={inc.id}
              onPress={() => router.push(`/incidents/${inc.id}`)}
              accessibilityLabel={`Incident ${inc.title}`}
            >
              <View style={styles.rowBetween}>
                <StatusBadge status={inc.severity} label={inc.severity} />
                <StatusBadge status={inc.status} />
              </View>
              <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 8 }]}>
                {inc.title}
              </Text>
            </SignalCard>
          ))
        )}

        {/* Service Health */}
        <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6, marginBottom: 8 }]}>
          Service Health
        </Text>
        {services.length === 0 ? <SignalCard><Text style={[typography.bodyBold, { color: colors.textPrimary }]}>No services available</Text><Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>Connect or sync Render to view service health.</Text></SignalCard> : null}
        {services.slice(0, 4).map((svc) => (
          <SignalCard key={svc.id} onPress={() => router.push(`/services/${svc.id}`)}>
            <View style={styles.rowBetween}>
              <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{svc.name}</Text>
              <StatusBadge status={svc.effectiveHealthStatus || svc.lastHealthStatus} />
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              {svc.repoFullName || 'Unlinked repository'} · {svc.lastLatencyMs ? `${svc.lastLatencyMs}ms` : 'No probe yet'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{svc.lastHealthCheckedAt ? `Last checked ${new Date(svc.lastHealthCheckedAt).toLocaleString()}` : 'No health check recorded'}</Text>
          </SignalCard>
        ))}

        {/* Recent Deployments */}
        {deployments.length > 0 ? (
          <>
            <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 6, marginBottom: 8 }]}>
              Recent Deployments
            </Text>
            {deployments.slice(0, 3).map((dep) => (
              <SignalCard key={dep.id} onPress={() => router.push(`/services/${dep.serviceId}`)}>
                <View style={styles.rowBetween}>
                  <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
                    {dep.branch || 'main'} · {dep.commitSha ? dep.commitSha.slice(0, 7) : dep.renderDeployId.slice(0, 8)}
                  </Text>
                  <StatusBadge status={dep.status} />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  {dep.commitMessage || `Trigger: ${dep.triggerSource}`}
                </Text>
              </SignalCard>
            ))}
          </>
        ) : null}
        <PrimaryButton label="Quick Actions" onPress={() => setQuickActionsVisible(true)} style={{ marginTop: 2, marginBottom: 12 }} />
        {dataUpdatedAt ? <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>Last refreshed {new Date(dataUpdatedAt).toLocaleString()}</Text> : null}
        </> : null}
      </ScrollView>

      {/* HM-06 Quick Actions Modal */}
      <Modal
        visible={quickActionsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickActionsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Quick Actions</Text>
            <PrimaryButton
              label="Declare Production Incident"
              tone="danger"
              onPress={() => {
                setQuickActionsVisible(false);
                router.push('/(tabs)/incidents');
              }}
              style={{ marginTop: 14 }}
            />
            <SecondaryButton
              label="Browse GitHub Repositories"
              onPress={() => {
                setQuickActionsVisible(false);
                router.push('/repositories');
              }}
              style={{ marginTop: 10 }}
            />
            <SecondaryButton
              label="View Services"
              onPress={() => {
                setQuickActionsVisible(false);
                router.push('/(tabs)/services');
              }}
              style={{ marginTop: 10 }}
            />
            <SecondaryButton
              label="Open Local Encrypted Drafts"
              onPress={() => {
                setQuickActionsVisible(false);
                router.push('/editor');
              }}
              style={{ marginTop: 10 }}
            />
            <SecondaryButton
              label="Close"
              onPress={() => setQuickActionsVisible(false)}
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollPad: { paddingLeft: 18, paddingRight: 31, paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { flexGrow: 1, flexBasis: 95, minWidth: 95 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },
});
