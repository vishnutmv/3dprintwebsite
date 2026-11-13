/**
 * Local references only — never business data.
 * The customer code is the key that authorises order lookups, and the
 * per-order code map lets a returning browser re-open a confirmation page.
 */

const CUSTOMER_KEY = "3dp-customer-code";
const ORDER_MAP_KEY = "3dp-order-codes";
const ACCOUNT_PROMPT_KEY = "3dp-account-prompt-dismissed";
const ACCOUNT_PROMPT_DAYS = 7;


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

/** Hide the returning-customer sign-in card for a while (after sign-in or "Not now"). */
export function dismissAccountPrompt(): void {
  try {
    localStorage.setItem(ACCOUNT_PROMPT_KEY, String(Date.now()));
  } catch {
    // Storage can be disabled; the card still closes for this visit.
  }
}

export function accountPromptDismissed(): boolean {
  try {
    const dismissedAt = Number(localStorage.getItem(ACCOUNT_PROMPT_KEY) ?? 0);
    return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < ACCOUNT_PROMPT_DAYS * 86_400_000;
  } catch {
    return false;
  }
}
