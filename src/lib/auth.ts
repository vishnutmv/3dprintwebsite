/**
 * Admin session state contains no credentials or session secret. Authentication
 * is maintained by an HttpOnly cookie and verified by the server.
 */

import { create } from "zustand";
import { apiGet, apiPost } from "./api";

type AuthState = {
  authenticated: boolean;
  initialized: boolean;
  email: string | null;
  signingIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearSession: () => void;
  verify: () => Promise<boolean>;
};

export const useAdminAuth = create<AuthState>()((set) => ({
  authenticated: false,
  initialized: false,
  email: null,
  signingIn: false,

  signIn: async (email, password) => {
    set({ signingIn: true });
    try {
      const result = await apiPost<{ admin: { email: string } }>("/api/admin/login", {
        email,
        password,
      });
      set({ authenticated: true, initialized: true, email: result.admin.email });
    } finally {
      set({ signingIn: false });
    }
  },

  signOut: async () => {
    try {
      await apiPost("/api/admin/logout", {});
    } finally {
      set({ authenticated: false, initialized: true, email: null });
    }
  },

  clearSession: () => set({ authenticated: false, initialized: true, email: null }),

  verify: async () => {
    try {
      const result = await apiGet<{ admin: { email: string } }>("/api/admin/session");
      set({ authenticated: true, initialized: true, email: result.admin.email });
      return true;
    } catch {
      set({ authenticated: false, initialized: true, email: null });
      return false;
    }
  },
}));
