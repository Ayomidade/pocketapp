import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = 'primary', // 'primary' | 'danger'
  accessibilityLabel,
  style,
  align = 'center',
}) {
  const { colors, radii, typography } = useTheme();
  const bgColor = tone === 'danger' ? colors.critical : colors.primary;
  const txtColor = tone === 'danger' ? '#FFFFFF' : colors.onPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bgColor,
          justifyContent: align === 'left' ? 'flex-start' : 'center',
          borderRadius: radii.button,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={txtColor} />
      ) : (
        <Text style={[typography.bodyBold, styles.label, { color: txtColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}) {
  const { colors, radii, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.bannerMuted,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.button,
          opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        },
        style,
      ]}
    >
      <Text style={[typography.bodyBold, styles.label, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: { flexShrink: 1, textAlign: 'center' },
});
