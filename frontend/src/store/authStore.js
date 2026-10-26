import { create } from 'zustand';
import { authAPI } from '../utils/api';

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('bes_token'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('bes_token'),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await authAPI.login({ email, password });
      const { user, accessToken, refreshToken } = res.data;
      localStorage.setItem('bes_token', accessToken);
      localStorage.setItem('bes_refresh_token', refreshToken);
      set({ user, token: accessToken, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, message: err.message };
    }
  },

  logout: () => {
    localStorage.removeItem('bes_token');
    localStorage.removeItem('bes_refresh_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('bes_token');
    if (!token) { set({ isAuthenticated: false }); return; }
    try {
      const res = await authAPI.getMe();
      set({ user: res.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('bes_token');
      set({ user: null, isAuthenticated: false });
    }
  },

  isAdmin: () => get().user?.role_name === 'admin',
  isEvaluator: () => ['evaluator', 'admin'].includes(get().user?.role_name),
}));

export default useAuthStore;
