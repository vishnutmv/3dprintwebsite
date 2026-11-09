/**
 * Framework-free request validation helpers for API routes.
 * Every helper returns predictable values or null so handlers can respond 400.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function optionalText(value: unknown, max = 500): string | null {
  const parsed = text(value, max);
  return parsed.length > 0 ? parsed : null;
}

export function positiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded >= 0 ? rounded : null;
}

export function intInRange(value: unknown, min: number, max: number): number | null {
  const parsed = positiveInt(value);
  if (parsed === null || parsed < min || parsed > max) return null;
  return parsed;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isPhone(value: string): boolean {
  const digits = phoneDigits(value);
  return digits.length >= 10 && digits.length <= 15;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Validates the checkout contact block. Returns an error string or null. */
export type Contact = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  marketingOptIn: boolean;
};

export function parseContact(value: unknown): { contact: Contact } | { error: string } {
  if (!isRecord(value)) return { error: "Delivery details are missing." };

  const name = text(value.name, 120);
  const email = text(value.email, 254).toLowerCase();
  const phone = text(value.phone, 24);
  const address = text(value.address, 500);
  const city = text(value.city, 100);
  const state = text(value.state, 100);
  const postalCode = text(value.postalCode ?? value.pin, 10);
  const marketingOptIn = value.marketingOptIn === true;

  if (name.length < 2) return { error: "Please enter your full name." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  if (!isPhone(phone)) return { error: "Please enter a valid phone number with 10–15 digits." };
  if (address.length < 5) return { error: "Please enter a complete delivery address." };
  if (city.length < 2) return { error: "Please enter your city." };
  if (state.length < 2) return { error: "Please enter your state." };
  if (!/^\d{4,6}$/.test(postalCode)) return { error: "Please enter a valid PIN / postal code." };

  return { contact: { name, email, phone, address, city, state, postalCode, marketingOptIn } };
}
