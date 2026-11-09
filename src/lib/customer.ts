/**
 * Local references only — never business data.
 * The customer code is the key that authorises order lookups, and the
 * per-order code map lets a returning browser re-open a confirmation page.
 */

const CUSTOMER_KEY = "3dp-customer-code";
const ORDER_MAP_KEY = "3dp-order-codes";

export function rememberCustomerCode(code: string): void {
  try {
    localStorage.setItem(CUSTOMER_KEY, code);
  } catch {
    // Storage can be disabled; the in-page navigation still carries the code.
  }
}

export function rememberedCustomerCode(): string {
  try {
    return localStorage.getItem(CUSTOMER_KEY) ?? "";
  } catch {
    return "";
  }
}

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ORDER_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function rememberOrderCode(orderNumber: string, code: string): void {
  try {
    const map = readMap();
    map[orderNumber] = code;
    const entries = Object.entries(map).slice(-25);
    localStorage.setItem(ORDER_MAP_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Non-critical.
  }
}

export function orderAccessCode(orderNumber: string): string {
  return readMap()[orderNumber] ?? "";
}
