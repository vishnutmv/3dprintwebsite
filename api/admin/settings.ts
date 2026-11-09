/**
 * GET   /api/admin/settings — values + safe capability booleans
 * PATCH /api/admin/settings — update store/shipping/notification settings
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handleError, json, methodNotAllowed, readJson } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";
import { getStoreSettings, saveStoreSettings, EDITABLE_SETTING_KEYS } from "../_lib/settings";
import { notificationCapabilities } from "../_lib/notify";
import { isEmail, intInRange, text } from "../_lib/validate";
import { adminEnv, razorpayEnv, supabaseEnv } from "../_lib/env";

function capabilities() {
  const flags = {
    supabase: false,
    razorpayTestMode: false,
    razorpayWebhook: false,
    adminAuth: false,
    email: false,
    webhook: false,
  };

  try {
    supabaseEnv();
    flags.supabase = true;
  } catch {
    flags.supabase = false;
  }
  try {
    razorpayEnv();
    flags.razorpayTestMode = true;
  } catch {
    flags.razorpayTestMode = false;
  }
  try {
    adminEnv();
    flags.adminAuth = true;
  } catch {
    flags.adminAuth = false;
  }
  flags.razorpayWebhook = Boolean((process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim());
  const notify = notificationCapabilities();
  flags.email = notify.email;
  flags.webhook = notify.webhook;

  return flags;
}

function settingsResponse(settings: Awaited<ReturnType<typeof getStoreSettings>>) {
  return {
    settings: {
      ...settings,
      razorpayKeyId: (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_")
        ? process.env.RAZORPAY_KEY_ID
        : "",
    },
    capabilities: capabilities(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "PATCH") {
    methodNotAllowed(res, ["GET", "PATCH"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      json(res, 200, settingsResponse(await getStoreSettings()));
      return;
    }

    const body = await readJson(req);
    const source = (body.settings && typeof body.settings === "object"
      ? body.settings
      : body) as Record<string, unknown>;

    const updates: Record<string, string> = {};
    for (const key of EDITABLE_SETTING_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const raw = source[key];

      if (key === "freeShippingOver" || key === "shippingFlat") {
        const value = intInRange(raw, 0, 10_000_000);
        if (value === null) {
          fail(res, 400, `${key} must be a whole number in paise.`);
          return;
        }
        updates[key] = String(value);
        continue;
      }

      const value = text(raw, 500);
      if (key === "supportEmail" && value && !isEmail(value)) {
        fail(res, 400, "Please provide a valid email address.");
        return;
      }
      updates[key] = key === "gstin" ? value.toUpperCase() : value;
    }

    if (Object.keys(updates).length === 0) {
      fail(res, 400, "Nothing to update.");
      return;
    }

    const saved = await saveStoreSettings(updates);
    json(res, 200, settingsResponse(saved));
  } catch (error) {
    handleError(res, error, "admin/settings");
  }
}
