import { create } from 'zustand';

export const useSessionsStore = create((set) => ({
  sessions: [],
  activeSession: null,
  loading: false,
  error: null,
  setSessions: (sessions) => set({ sessions }),
  setActiveSession: (activeSession) => set({ activeSession }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
