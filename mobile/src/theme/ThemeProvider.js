import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { signalLight, signalDark, spacing, radii, typography, relayBrand } from './tokens';
import { useAppStore } from '../store/useAppStore';

const ThemeContext = createContext(null);

export function ThemeProvider({ children, previewMode }) {
  const systemScheme = useColorScheme();
  const themePreference = useAppStore((s) => s.themePreference);
  const highContrast = useAppStore((s) => s.highContrast);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  const value = useMemo(() => {
    const resolvedMode =
      previewMode || (themePreference === 'system'
        ? systemScheme === 'dark'
          ? 'dark'
          : 'light'
        : themePreference);

    const baseColors = resolvedMode === 'dark' ? signalDark : signalLight;
    const colors = highContrast
      ? {
          ...baseColors,
          border: resolvedMode === 'dark' ? '#5E7884' : '#6A8189',
        }
      : baseColors;

    return {
      mode: resolvedMode,
      isDark: resolvedMode === 'dark',
      colors,
      relayBrand,
      spacing,
      radii,
      typography,
      reducedMotion,
      highContrast,
    };
  }, [systemScheme, themePreference, highContrast, reducedMotion, previewMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
