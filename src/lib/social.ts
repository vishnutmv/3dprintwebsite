/**
 * Storefront social state: favourites, the customer notification inbox and
 * product-review calls. Everything here requires a signed-in customer except
 * the public read-only review queries.
 */

import { create } from "zustand";
import { apiDelete, apiGet, apiPost } from "./api";
import type {
  CustomerNotification,
  Product,
  ProductReview,
  ReviewSummary,
} from "./types";

type SocialState = {
  favorites: string[];
  favoriteProducts: Product[];
  notifications: CustomerNotification[];
  unreadCount: number;
  loadedFor: string | null;
  loading: boolean;

  fetchSocial: (customerCode: string) => Promise<void>;
  toggleFavorite: (product: Product) => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
};

export const useSocial = create<SocialState>((set, get) => ({
  favorites: [],
  favoriteProducts: [],
  notifications: [],
  unreadCount: 0,
  loadedFor: null,
  loading: false,

  fetchSocial: async (customerCode) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [favorites, inbox] = await Promise.all([
        apiGet<{ productIds: string[]; products: Product[] }>("/api/customer/favorites"),
        apiGet<{ notifications: CustomerNotification[]; unreadCount: number }>(
          "/api/customer/notifications",
        ),
      ]);
      set({
        favorites: favorites.productIds ?? [],
        favoriteProducts: favorites.products ?? [],
        notifications: inbox.notifications ?? [],
        unreadCount: inbox.unreadCount ?? 0,
        loadedFor: customerCode,
      });
    } catch (error) {
      console.error("Could not load favourites and notifications:", error);
      set({ loadedFor: customerCode });
    } finally {
      set({ loading: false });
    }
  },

  toggleFavorite: async (product) => {
    const wasFavorite = get().favorites.includes(product.id);
    const previousFavorites = get().favorites;
    const previousProducts = get().favoriteProducts;
    set({
      favorites: wasFavorite
        ? previousFavorites.filter((id) => id !== product.id)
        : [product.id, ...previousFavorites],
      favoriteProducts: wasFavorite
        ? previousProducts.filter((item) => item.id !== product.id)
        : [product, ...previousProducts.filter((item) => item.id !== product.id)],
    });
    try {
      const response = wasFavorite
        ? await apiDelete<{ productIds: string[]; products: Product[] }>(
            `/api/customer/favorites/${encodeURIComponent(product.id)}`,
          )
        : await apiPost<{ productIds: string[]; products: Product[] }>(
            "/api/customer/favorites",
            { productId: product.id },
          );
      set({
        favorites: response.productIds ?? [],
        favoriteProducts: response.products ?? [],
      });
      return !wasFavorite;
    } catch (error) {
      set({ favorites: previousFavorites, favoriteProducts: previousProducts });
      throw error;
    }
  },

  refreshNotifications: async () => {
    try {
      const inbox = await apiGet<{ notifications: CustomerNotification[]; unreadCount: number }>(
        "/api/customer/notifications",
      );
      set({ notifications: inbox.notifications ?? [], unreadCount: inbox.unreadCount ?? 0 });
    } catch (error) {
      console.error("Could not refresh notifications:", error);
    }
  },

  markAllRead: async () => {
    const previous = get().notifications;
    set({
      notifications: previous.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    });
    try {
      const inbox = await apiPost<{ notifications: CustomerNotification[]; unreadCount: number }>(
        "/api/customer/notifications/read",
        {},
      );
      set({ notifications: inbox.notifications ?? [], unreadCount: inbox.unreadCount ?? 0 });
    } catch (error) {
      set({ notifications: previous });
      throw error;
    }
  },

  reset: () =>
    set({
      favorites: [],
      favoriteProducts: [],
      notifications: [],
      unreadCount: 0,
      loadedFor: null,
    }),
}));

/* ------------------------------ reviews API ------------------------------ */

export async function getProductReviews(productId: string) {
  return apiGet<{ reviews: ProductReview[]; summary: ReviewSummary; adminName: string }>(
    `/api/products/${encodeURIComponent(productId)}/reviews`,
  );
}

export async function createProductReview(
  productId: string,
  input: { rating: number; title?: string; body: string },
) {
  return apiPost<{ review: ProductReview | null; summary: ReviewSummary }>(
    `/api/products/${encodeURIComponent(productId)}/reviews`,
    input,
  );
}

export async function getFeaturedReviews(limit = 6) {
  const response = await apiGet<{ reviews: ProductReview[] }>(
    `/api/reviews?featured=1&limit=${limit}`,
  );
  return response.reviews;
}
