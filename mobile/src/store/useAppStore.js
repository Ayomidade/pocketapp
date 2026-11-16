import { create } from 'zustand';

export const useAppStore = create((set) => ({
  themePreference: 'system', // 'system' | 'light' | 'dark'
  highContrast: false,
  reducedMotion: false,
  fontScaleMode: 'standard', // 'standard' | 'large'
  activeProjectId: null,
  activeEditorFile: null, // { repoId, repoFullName, branch, path, baseSha, content, originalContent }

  setThemePreference: (themePreference) => set({ themePreference }),
  setHighContrast: (highContrast) => set({ highContrast }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setFontScaleMode: (fontScaleMode) => set({ fontScaleMode }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setActiveEditorFile: (activeEditorFile) => set({ activeEditorFile }),
  clearActiveEditorFile: () => set({ activeEditorFile: null }),
}));
