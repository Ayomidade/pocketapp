import { create } from 'zustand';
import { clearTokens, getAccessToken, saveTokens } from '../security/tokenStorage';

export const useAuthStore = create((set) => ({
  status: 'booting', // 'booting' | 'unauthenticated' | 'authenticated'
  user: null,
  authError: null,

  setBooting: () => set({ status: 'booting', authError: null }),
  setAuthenticated: async ({ user, accessToken, refreshToken }) => {
    if (accessToken || refreshToken) {
      await saveTokens({ accessToken, refreshToken });
    }
    set({ status: 'authenticated', user, authError: null });
  },
  updateUser: (partial) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...partial } : partial,
    })),
  setAuthError: (authError) => set({ authError }),
  signOutLocal: async () => {
    await clearTokens();
    set({ status: 'unauthenticated', user: null, authError: null });
  },
  hasStoredSession: async () => {
    const token = await getAccessToken();
    return Boolean(token);
  },
}));
