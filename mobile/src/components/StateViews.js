import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { SignalCard } from './SignalCard';
import { PrimaryButton, SecondaryButton } from './Buttons';

export function LoadingState({ message = 'Loading operational telemetry...' }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12 }]}>
        {message}
      </Text>
    </View>
  );
}

export function EmptyState({ icon = 'layers-outline', title, description, actionLabel, onAction }) {
  const { colors, typography } = useTheme();
  return (
    <SignalCard style={styles.emptyCard}>
      <Ionicons name={icon} size={30} color={colors.primary} />
      <Text style={[typography.heading, { color: colors.textPrimary, marginTop: 10 }]}>
        {title}
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 6, textAlign: 'center' }]}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={{ marginTop: 16, width: '100%' }} />
      ) : null}
    </SignalCard>
  );
}

export function ErrorState({ title = 'Unable to load data', message, onRetry }) {
  const { colors, typography } = useTheme();
  return (
    <SignalCard style={{ borderColor: colors.critical, backgroundColor: colors.criticalBg }}>
      <View style={styles.row}>
        <Ionicons name="alert-circle" size={22} color={colors.critical} />
        <Text style={[typography.heading, { color: colors.critical }]}>{title}</Text>
      </View>
      <Text style={[typography.body, { color: colors.textPrimary, marginTop: 6 }]}>
        {message || 'An unexpected error occurred while contacting PocketOps API.'}
      </Text>
      {onRetry ? (
        <SecondaryButton label="Retry" onPress={onRetry} style={{ marginTop: 12 }} />
      ) : null}
    </SignalCard>
  );
}

export function OfflineBanner({ message = 'Offline mode — changes are saved as encrypted local drafts.' }) {
  const { colors, typography, radii } = useTheme();
  return (
    <View
      style={[
        styles.offline,
        { backgroundColor: colors.warningBg, borderColor: colors.warning, borderRadius: radii.card },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={[typography.caption, { color: colors.warning, flex: 1 }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', paddingVertical: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
});
