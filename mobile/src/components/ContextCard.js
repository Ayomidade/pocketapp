import React from 'react';
import { Text } from 'react-native';
import { SignalCard } from './SignalCard';
import { useTheme } from '../theme/ThemeProvider';

export function ContextCard({ title, description }) {
  const { colors, typography } = useTheme();
  return <SignalCard style={{ minHeight: 66, paddingVertical: 12, justifyContent: 'center' }}>
    <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>{title}</Text>
    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>{description}</Text>
  </SignalCard>;
}
