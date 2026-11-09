/**
 * Format utilities — INR, dates, class joining, and admin auth helpers.
 * All functions are pure and have no runtime dependencies beyond the browser API.
 */

export function inr(amountOrOrder: number | { total: number }): string {
  const amount = typeof amountOrOrder === "object" ? amountOrOrder.total : amountOrOrder;
  return `₹${(amount / 100).toFixed(2)}`;
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Two-letter initials for avatar chips. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatPrice(pricePaise: number): string {
  return `₹${(pricePaise / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomToken(length: number): string {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Non-guessable customer ID, e.g. 3DP-K4M2-9XQP. */
export function newCustomerId(): string {
  return `3DP-${randomToken(4)}-${randomToken(4)}`;
}

/** Human-readable order ID, e.g. ORD-8H2K4M. */
export function newOrderId(): string {
  return `ORD-${randomToken(6)}`;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove non-word chars
    .replace(/_-+|-+/g, "") // Remove consecutive hyphens
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}