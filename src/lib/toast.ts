/**
 * Toast store — small zustand queue rendered by <Toaster />.
 * `useToast((state) => state.push)` gives a `push(message, tone?)` function.
 */

import { create } from "zustand";

export type ToastTone = "info" | "success" | "warn" | "error";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
};

export const useToast = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
