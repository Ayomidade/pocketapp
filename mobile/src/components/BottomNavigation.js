import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export function BottomNavigation({ items }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ flexDirection: 'row', backgroundColor: colors.canvas, paddingHorizontal: 8, paddingBottom: insets.bottom }}>
    {items.map(({ key, title, selected, accessibilityLabel, onPress, onLongPress }) => <Pressable
      key={key}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}
    >
      <Text style={{ fontSize: 11, fontWeight: selected ? '700' : '500', color: selected ? colors.primary : colors.textSecondary, textAlign: 'center' }}>{title}</Text>
    </Pressable>)}
  </View>;
}
