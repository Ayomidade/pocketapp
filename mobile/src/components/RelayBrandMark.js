import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

const RELAY_ICON = require('../../assets/relay-symbol.png');

export function RelayBrandMark({ size = 56, showWordmark = true, variant = 'dark' }) {
  const { relayBrand, typography } = useTheme();
  const isDarkContainer = variant === 'dark';

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.iconFrame,
          {
            width: size,
            height: size,
            borderRadius: Math.round(size * 0.24),
            backgroundColor: isDarkContainer ? relayBrand.deepNavy : relayBrand.cloud,
            borderColor: isDarkContainer ? '#1F3A56' : '#DCE4EC',
          },
        ]}
      >
        <Image
          source={RELAY_ICON}
          style={{ width: size * 0.72, height: size * 0.72 }}
          resizeMode="contain"
          accessibilityLabel="PocketOps Relay logo"
        />
      </View>
      {showWordmark ? (
        <View style={styles.wordmarkWrap}>
          <Text
            style={[
              typography.title,
              { color: isDarkContainer ? '#FFFFFF' : relayBrand.deepNavy, letterSpacing: -0.3 },
            ]}
          >
            PocketOps
          </Text>
          <Text
            style={[
              typography.caption,
              { color: isDarkContainer ? relayBrand.tealOps : '#3B5266' },
            ]}
          >
            RELAY
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  wordmarkWrap: { justifyContent: 'center' },
});
