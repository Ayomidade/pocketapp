import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';

export function ModuleHeader({
  code,
  title,
  subtitle,
  showBack = false,
  rightAction,
}) {
  const router = useRouter();
  const { colors, radii, typography } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={[
                styles.backButton,
                { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </Pressable>
          ) : null}
          {code ? (
            <View
              style={[
                styles.codeBadge,
                { backgroundColor: colors.primary, borderRadius: radii.pill },
              ]}
            >
              <Text style={[typography.badge, { color: colors.onPrimary }]}>{code}</Text>
            </View>
          ) : null}
        </View>
        {rightAction ? <View>{rightAction}</View> : null}
      </View>

      <Text style={[typography.title, { color: colors.textPrimary, marginTop: 10 }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 4 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 10, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  codeBadge: {
    minWidth: 50,
    height: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
