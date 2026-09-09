import { create } from 'zustand';

export const useApprovalsStore = create((set) => ({
  approval: null,
  isSubmitting: false,
  error: null,
  setApproval: (approval) => set({ approval, error: null }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setError: (error) => set({ error, isSubmitting: false }),
  clear: () => set({ approval: null, isSubmitting: false, error: null }),
}));
