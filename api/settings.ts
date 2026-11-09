/**
 * GET /api/settings — safe public store configuration.
 * Never returns Razorpay secrets, admin credentials or notification keys.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleError, json, methodNotAllowed } from "./_lib/http";
import { getStoreSettings, publicSettings } from "./_lib/settings";
import { notificationCapabilities } from "./_lib/notify";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const settings = await getStoreSettings();
    const keyId = (process.env.RAZORPAY_KEY_ID ?? "").trim();
    const secretConfigured = Boolean((process.env.RAZORPAY_KEY_SECRET ?? "").trim());
    const paymentsReady = keyId.startsWith("rzp_test_") && secretConfigured;

    json(res, 200, {
      settings: publicSettings(settings, {
        razorpayKeyId: keyId.startsWith("rzp_test_") ? keyId : "",
        paymentsReady,
        notifications: notificationCapabilities(),
      }),
    });
  } catch (error) {
    handleError(res, error, "GET /api/settings");
  }
}
