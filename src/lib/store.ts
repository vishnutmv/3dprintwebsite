/**
 * Storefront state.
 *
 * Business data (products, customers, orders, payments, prizes) is owned by
 * MariaDB and fetched from /api. Only the shopping cart is persisted in
 * localStorage — it is a temporary UI convenience, not a source of truth.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiGet } from "./api";
import type { CartItem, Prize, Product, StoreSettings } from "./types";
import { effectiveProductPrice, serverNow, setServerClock } from "./promotions";

type CartLine = { product: Product; qty: number; lineTotal: number };

const fallbackSettings: StoreSettings = {
  storeName: "3D Print Co.",
  supportEmail: "orders@3dprintco.in",
  supportPhone: "+91 98400 00000",
  city: "Chennai",
  gstin: "",
  freeShippingOver: 149900,
  shippingFlat: 4900,
  razorpayKeyId: "",
  paymentsReady: false,
  notifyEmail: "",
};

type State = {
  products: Product[];
  settings: StoreSettings;
  prizes: Prize[];
  cart: CartItem[];
  loaded: boolean;
  loading: boolean;
  message: string | undefined;

  bootstrap: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchPrizes: () => Promise<void>;

  addToCart: (product: Product, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      products: [],
      settings: fallbackSettings,
      prizes: [],
      cart: [],
      loaded: false,
      loading: false,
      message: undefined,

      fetchProducts: async () => {
        try {
          const { products } = await apiGet<{ products: Product[] }>("/api/products");
          if (!Array.isArray(products)) throw new Error("The product API returned an invalid catalogue.");
          set({ products, loaded: true, message: undefined });
        } catch (error) {
          set({
            loaded: true,
            message:
              error instanceof Error
                ? error.message
                : "Could not load the catalogue. Please try again.",
          });
        }
      },

      fetchSettings: async () => {
        try {
          const { settings } = await apiGet<{ settings: StoreSettings }>("/api/settings");
          if (!settings || typeof settings !== "object") throw new Error("The settings API returned invalid data.");
          setServerClock(settings.serverTime);
          set({ settings: { ...fallbackSettings, ...settings } });
        } catch (error) {
          console.error("Could not load store settings:", error);
        }
      },

      fetchPrizes: async () => {
        try {
          const { prizes } = await apiGet<{ prizes: Prize[] }>("/api/prizes");
          if (!Array.isArray(prizes)) throw new Error("The prizes API returned invalid data.");
          set({ prizes });
        } catch (error) {
          console.error("Could not load public prizes:", error);
        }
      },

      bootstrap: async () => {
        if (get().loading) return;
        set({ loading: true });
        try {
          await Promise.all([get().fetchProducts(), get().fetchSettings(), get().fetchPrizes()]);
        } finally {
          set({ loading: false });
        }
      },

      addToCart: (product, qty = 1) =>
        set((state) => {
          if (product.stock <= 0 || qty <= 0) return state;
          const existing = state.cart.find((item) => item.productId === product.id);
          if (existing) {
            const nextQty = Math.min(product.stock, existing.qty + qty);
            return {
              cart: state.cart.map((item) =>
                item.productId === product.id ? { ...item, qty: nextQty } : item,
              ),
            };
          }
          return {
            cart: [...state.cart, { productId: product.id, qty: Math.min(product.stock, qty) }],
          };
        }),

      setQty: (productId, qty) =>
        set((state) => {
          const product = state.products.find((candidate) => candidate.id === productId);
          const max = product?.stock ?? qty;
          const next = Math.min(Math.max(0, qty), Math.max(0, max));
          return {
            cart:
              next <= 0
                ? state.cart.filter((item) => item.productId !== productId)
                : state.cart.map((item) =>
                    item.productId === productId ? { ...item, qty: next } : item,
                  ),
          };
        }),

      removeFromCart: (productId) =>
        set((state) => ({ cart: state.cart.filter((item) => item.productId !== productId) })),

      clearCart: () => set({ cart: [] }),
    }),
    {
      name: "3dp-cart-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
    },
  ),
);

export function cartLines(state: Pick<State, "cart" | "products">, now = serverNow()): CartLine[] {
  return state.cart.flatMap((item) => {
    const product = state.products.find((candidate) => candidate.id === item.productId);
    if (!product) return [];
    return [{ product, qty: item.qty, lineTotal: effectiveProductPrice(product, now) * item.qty }];
  });
}

export function cartPercent(state: Pick<State, "cart">) {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

export function cartSubtotal(state: Pick<State, "cart" | "products">, now = serverNow()): number {
  return cartLines(state, now).reduce((sum, line) => sum + line.lineTotal, 0);
}

export type { State };
