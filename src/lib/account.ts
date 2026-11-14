/**
 * Signed-in customer, shared across the storefront.
 *
 * The session itself lives in an httpOnly cookie owned by the API; this store
 * only mirrors the profile so the header can greet the customer and the profile
 * page can pre-fill its edit form. It is never persisted to localStorage.
 */

import { create } from "zustand";
import { ApiError, apiGet } from "./api";
import type { CustomerProfile } from "./types";

type AccountState = {
  customer: CustomerProfile | null;
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  setCustomer: (customer: CustomerProfile | null) => void;
  clear: () => void;
};

export const useAccount = create<AccountState>((set, get) => ({
  customer: null,
  loading: false,
  loaded: false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const response = await apiGet<{ customer: CustomerProfile }>("/api/customer/me");
      set({ customer: response.customer, loaded: true });
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 401)) {
        console.error("Could not load the customer session:", caught);
      }
      set({ customer: null, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  setCustomer: (customer) => set({ customer, loaded: true }),

  clear: () => set({ customer: null, loaded: true }),
}));

/** First name for greetings; falls back to the whole name for single-word names. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
