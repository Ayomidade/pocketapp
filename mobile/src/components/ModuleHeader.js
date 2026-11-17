import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/ThemeProvider';

export function ModuleHeader({ code, title, subtitle, showBack = false, rightAction }) {
  const router = useRouter();
  const { colors, radii, typography } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={[styles.back, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill }]}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        {code && !showBack ? (
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.mark, { backgroundColor: colors.primary, borderRadius: radii.pill }]}>
            <Ionicons name="terminal-outline" size={20} color={colors.onPrimary} />
          </View>
        ) : null}
        <View style={styles.text}>
          <Text style={[typography.badge, { color: colors.primary, letterSpacing: 0.4 }]}>POCKETOPS</Text>
          <Text accessibilityRole="header" style={[typography.title, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        {rightAction ? <View style={styles.actions}>{rightAction}</View> : null}
      </View>
      {subtitle ? <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 6 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 8, paddingBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  actions: { flexShrink: 0 },
  back: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  mark: { width: 50, height: 34, alignItems: 'center', justifyContent: 'center' },
});
