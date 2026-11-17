import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

const VARIANT_MAP = {
  verified: { textKey: 'verified', bgKey: 'verifiedBg' },
  healthy: { textKey: 'verified', bgKey: 'verifiedBg' },
  live: { textKey: 'verified', bgKey: 'verifiedBg' },
  resolved: { textKey: 'verified', bgKey: 'verifiedBg' },

  critical: { textKey: 'critical', bgKey: 'criticalBg' },
  unhealthy: { textKey: 'critical', bgKey: 'criticalBg' },
  P1: { textKey: 'critical', bgKey: 'criticalBg' },
  build_failed: { textKey: 'critical', bgKey: 'criticalBg' },
  update_failed: { textKey: 'critical', bgKey: 'criticalBg' },
  open: { textKey: 'critical', bgKey: 'criticalBg' },

  warning: { textKey: 'warning', bgKey: 'warningBg' },
  degraded: { textKey: 'warning', bgKey: 'warningBg' },
  P2: { textKey: 'warning', bgKey: 'warningBg' },
  pending: { textKey: 'warning', bgKey: 'warningBg' },
  investigating: { textKey: 'warning', bgKey: 'warningBg' },
  mitigating: { textKey: 'warning', bgKey: 'warningBg' },
  stale: { textKey: 'warning', bgKey: 'warningBg' },

  info: { textKey: 'info', bgKey: 'infoBg' },
  P3: { textKey: 'info', bgKey: 'infoBg' },
  monitoring: { textKey: 'info', bgKey: 'infoBg' },
  checking: { textKey: 'info', bgKey: 'infoBg' },
  local_draft: { textKey: 'info', bgKey: 'infoBg' },

  unknown: { textKey: 'unknown', bgKey: 'unknownBg' },
  unlinked: { textKey: 'unknown', bgKey: 'unknownBg' },
};

export function StatusBadge({ status = 'unknown', label }) {
  const { colors, radii, typography } = useTheme();
  const mapping = VARIANT_MAP[status] || VARIANT_MAP.unknown;
  const fg = colors[mapping.textKey];
  const bg = colors[mapping.bgKey];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg, borderColor: fg, borderRadius: radii.pill },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: fg }]} />
      <Text style={[typography.badge, { color: fg, textTransform: 'uppercase', flexShrink: 1 }]}>
        {label || String(status).replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
