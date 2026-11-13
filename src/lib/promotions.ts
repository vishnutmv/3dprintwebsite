import { useSyncExternalStore } from "react";
import type { Product } from "./types";

export type PromotionState = "scheduled" | "active" | "ended" | "none";

let promotionClock = Date.now();
let promotionClockInterval: number | null = null;
const promotionClockListeners = new Set<() => void>();

/**
 * Storefront timers run on the server's clock so a device with the wrong time
 * still sees the same offer window as the price the API will charge.
 */
let serverOffsetMs = 0;

export function setServerClock(iso?: string | null): void {
  if (!iso) return;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return;
  serverOffsetMs = parsed - Date.now();
  promotionClock = serverNow();
  promotionClockListeners.forEach((notify) => notify());
}

export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

function subscribeToPromotionClock(listener: () => void): () => void {
  promotionClockListeners.add(listener);
  if (promotionClockInterval === null && typeof window !== "undefined") {
    promotionClockInterval = window.setInterval(() => {
      promotionClock = serverNow();
      promotionClockListeners.forEach((notify) => notify());
    }, 30_000);
  }
  return () => {
    promotionClockListeners.delete(listener);
    if (promotionClockListeners.size === 0 && promotionClockInterval !== null) {
      window.clearInterval(promotionClockInterval);
      promotionClockInterval = null;
    }
  };
}

export function usePromotionClock(): number {
  return useSyncExternalStore(subscribeToPromotionClock, () => promotionClock, () => promotionClock);
}

export function promotionState(product: Product, now = serverNow()): PromotionState {
  if (!product.promotionPrice || !product.promotionStartAt || !product.promotionEndAt) return "none";
  const startsAt = Date.parse(product.promotionStartAt);
  const endsAt = Date.parse(product.promotionEndAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) return "none";
  if (now < startsAt) return "scheduled";
  if (now < endsAt) return "active";
  return "ended";
}

export function effectiveProductPrice(product: Product, now = serverNow()): number {
  return promotionState(product, now) === "active" && product.promotionPrice
    ? product.promotionPrice
    : product.price;
}

export function toISTDateTimeInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((valuePart) => valuePart.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function fromISTDateTimeInput(value: string): string | null {
  if (!value) return null;
  const timestamp = new Date(`${value}:00+05:30`);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
}
