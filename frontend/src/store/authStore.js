import { create } from 'zustand';
import { authAPI } from '../utils/api';

// Centralized storage keys
const TOKEN_KEY = 'bes_token';
const REFRESH_TOKEN_KEY = 'bes_refresh_token';

const useAuthStore = create((set, get) => {
  const storedToken = localStorage.getItem(TOKEN_KEY);

  return {
    user: null,
    token: storedToken,
    isLoading: false,
    isAuthenticated: Boolean(storedToken),

    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const res = await authAPI.login({ email, password });
        const { user, accessToken, refreshToken } = res.data;

        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

        set({
          user,
          token: accessToken,
          isAuthenticated: true,
          isLoading: false,
        });

        return { success: true };
      } catch (err) {
        set({ isLoading: false });
        return {
          success: false,
          message: err?.message || 'Login failed',
        };
      }
    },

    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);

      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    },

    loadUser: async () => {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        set({ isAuthenticated: false });
        return;
      }

      try {
        const res = await authAPI.getMe();
        set({ user: res.data, isAuthenticated: true });
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY);
        set({ user: null, isAuthenticated: false });
      }
    },

    isAdmin: () => get().user?.role_name === 'admin',

    isEvaluator: () =>
      ['evaluator', 'admin'].includes(get().user?.role_name),
  };
});

export default useAuthStore;