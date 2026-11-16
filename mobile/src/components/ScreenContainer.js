import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export function ScreenContainer({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'left', 'right'],
  style,
}) {
  const { colors, spacing } = useTheme();

  const inner = (
    <View
      style={[
        styles.inner,
        padded && { paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl },
        style,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {inner}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{inner}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  inner: { width: '100%', maxWidth: 640, alignSelf: 'center', flexGrow: 1 },
});
