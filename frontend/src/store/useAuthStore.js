import { create } from 'zustand';

function savedSession() {
  const token = localStorage.getItem('token');
  if (!token) return {};
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { token, role: localStorage.getItem('role') || payload.role || null, userId: localStorage.getItem('userId') || payload.userId || null };
  } catch { return { token, role: localStorage.getItem('role'), userId: localStorage.getItem('userId') }; }
}

const saved = savedSession();

export const useAuthStore = create((set) => ({
  token: saved.token ?? null,
  role: saved.role ?? null,
  userId: saved.userId ?? null,
  isLoading: false,
  error: null,

  setSession: ({ token, role, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('role', role ?? '');
    localStorage.setItem('userId', userId ?? '');
    set({ token, role, userId, error: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  logout: () => { localStorage.removeItem('token'); localStorage.removeItem('role'); localStorage.removeItem('userId'); set({ token: null, role: null, userId: null }); },
}));
