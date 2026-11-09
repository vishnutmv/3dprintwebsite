import { db } from "./supabase";
import { mapSettings, type StoreSettings } from "./mapping";

export const EDITABLE_SETTING_KEYS = [
  "storeName",
  "supportEmail",
  "supportPhone",
  "city",
  "gstin",
  "freeShippingOver",
  "shippingFlat",
] as const;

export async function getStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await db()
    .from("settings")
    .select("setting_key,setting_value");
  if (error) throw new Error(`Could not load store settings: ${error.message}`);
  return mapSettings((data ?? []) as { setting_key: string; setting_value: string }[]);
}

export async function saveStoreSettings(values: Record<string, string>): Promise<StoreSettings> {
  const rows = Object.entries(values)
    .filter(([key]) => (EDITABLE_SETTING_KEYS as readonly string[]).includes(key))
    .map(([key, value]) => ({ setting_key: key, setting_value: String(value) }));

  if (rows.length > 0) {
    const { error } = await db()
      .from("settings")
      .upsert(rows, { onConflict: "setting_key" });
    if (error) throw new Error(`Could not save settings: ${error.message}`);
  }
  return getStoreSettings();
}

export function publicSettings(settings: StoreSettings, input: {
  razorpayKeyId: string;
  paymentsReady: boolean;
  notifications: { email: boolean; webhook: boolean };
}) {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    city: settings.city,
    gstin: settings.gstin,
    freeShippingOver: settings.freeShippingOver,
    shippingFlat: settings.shippingFlat,
    razorpayKeyId: input.razorpayKeyId,
    paymentsReady: input.paymentsReady,
    notifications: input.notifications,
  };
}
