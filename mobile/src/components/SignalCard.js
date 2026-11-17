import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function SignalCard({ children, onPress, style, accessibilityLabel }) {
  const { colors, radii } = useTheme();
  const containerStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.card,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [containerStyle, pressed && { opacity: 0.88 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={containerStyle}>{children}</View>;
}

export function SignalBanner({ children, style }) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.bannerMuted,
          borderRadius: radii.banner,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SignalIntro({ eyebrow, title, description }) {
  const { colors, typography } = useTheme();
  return (
    <SignalBanner>
      {eyebrow ? <Text style={[typography.badge, { color: colors.primary }]}>{eyebrow.toUpperCase()}</Text> : null}
      <Text accessibilityRole="header" style={[typography.title, { color: colors.textPrimary, marginTop: eyebrow ? 8 : 0 }]}>{title}</Text>
      {description ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 8 }]}>{description}</Text> : null}
    </SignalBanner>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 15,
    marginBottom: 14,
  },
  banner: {
    padding: 16,
    marginBottom: 14,
  },
});
