/**
 * Product payload validation for admin create/update routes.
 * Money arrives in paise; the admin UI converts from rupees before sending.
 */

import { intInRange, isHttpUrl, slugify, text } from "./validate";

export const VARIANTS = ["dragon", "organiser", "gear", "planter", "knight", "spool", "lattice"];

function stringArray(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const urls = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (urls.length > max) return null;
  if (urls.some((url) => !isHttpUrl(url))) return null;
  return urls;
}

function specs(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 30) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (typeof raw !== "string") return null;
    const cleanKey = key.trim().slice(0, 60);
    if (!cleanKey) continue;
    out[cleanKey] = raw.trim().slice(0, 300);
  }
  return out;
}

export type ProductValues = {
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  price?: number;
  mrp?: number | null;
  stock_quantity?: number;
  images?: string[];
  video_url?: string | null;
  specifications?: Record<string, string>;
  material?: string;
  dimensions?: string;
  print_time?: string;
  badge?: string | null;
  variant?: string;
  accent?: string;
  model_url?: string | null;
  rating?: number;
  reviews?: number;
  is_active?: boolean;
};

export function parseProductPayload(
  body: Record<string, unknown>,
  partial: boolean,
): { values: ProductValues } | { error: string } {
  const values: ProductValues = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

  if (has("name") || !partial) {
    const name = text(body.name, 160);
    if (name.length < 2) return { error: "Product name is required." };
    values.name = name;
  }

  if (has("slug")) {
    const slug = slugify(text(body.slug, 160));
    if (!slug) return { error: "Slug is invalid." };
    values.slug = slug;
  }

  if (has("description")) values.description = text(body.description, 5000);
  if (has("category")) values.category = text(body.category, 80) || "Uncategorised";

  if (has("price") || !partial) {
    const price = intInRange(body.price, 1, 100_000_000);
    if (price === null) return { error: "Price must be a positive whole number in paise." };
    values.price = price;
  }

  if (has("mrp")) {
    if (body.mrp === null || body.mrp === "") {
      values.mrp = null;
    } else {
      const mrp = intInRange(body.mrp, 1, 100_000_000);
      if (mrp === null) return { error: "MRP must be a positive whole number in paise." };
      values.mrp = mrp;
    }
  }

  if (has("stock") || has("stockQuantity") || has("stock_quantity")) {
    const raw = has("stock") ? body.stock : has("stockQuantity") ? body.stockQuantity : body.stock_quantity;
    const stock = intInRange(raw, 0, 1_000_000);
    if (stock === null) return { error: "Stock must be a whole number of zero or more." };
    values.stock_quantity = stock;
  }

  if (has("images")) {
    const images = stringArray(body.images, 8);
    if (!images) return { error: "Images must be up to 8 valid http(s) URLs." };
    values.images = images;
  }

  if (has("videoUrl") || has("video_url")) {
    const raw = text(has("videoUrl") ? body.videoUrl : body.video_url, 500);
    if (raw && !isHttpUrl(raw)) return { error: "Video URL must be a valid http(s) URL." };
    values.video_url = raw || null;
  }

  if (has("specifications")) {
    const parsed = specs(body.specifications);
    if (!parsed) return { error: "Specifications must be an object of short text values." };
    values.specifications = parsed;
  }

  if (has("material")) values.material = text(body.material, 200);
  if (has("dimensions")) values.dimensions = text(body.dimensions, 200);
  if (has("printTime") || has("print_time")) {
    values.print_time = text(has("printTime") ? body.printTime : body.print_time, 120);
  }

  if (has("badge")) values.badge = text(body.badge, 60) || null;

  if (has("variant")) {
    const variant = text(body.variant, 40);
    if (!VARIANTS.includes(variant)) return { error: "Unknown 3D fallback shape." };
    values.variant = variant;
  }

  if (has("accent")) {
    const accent = text(body.accent, 20);
    if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return { error: "Accent must be a hex colour like #a78bfa." };
    values.accent = accent;
  }

  if (has("modelUrl") || has("model_url")) {
    const raw = text(has("modelUrl") ? body.modelUrl : body.model_url, 500);
    if (raw && !isHttpUrl(raw)) return { error: "Model URL must be a valid http(s) URL." };
    values.model_url = raw || null;
  }

  if (has("rating")) {
    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return { error: "Rating must be between 0 and 5." };
    }
    values.rating = Math.round(rating * 100) / 100;
  }

  if (has("reviews")) {
    const reviews = intInRange(body.reviews, 0, 10_000_000);
    if (reviews === null) return { error: "Reviews must be zero or more." };
    values.reviews = reviews;
  }

  if (has("active") || has("isActive")) {
    values.is_active = Boolean(has("active") ? body.active : body.isActive);
  }

  if (partial && Object.keys(values).length === 0) {
    return { error: "Nothing to update." };
  }

  return { values };
}
