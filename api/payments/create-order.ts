/**
 * POST /api/payments/create-order
 * Body: { orderNumber, customerCode }
 *
 * Safe retry path: reuses the stored order amount and the existing Razorpay
 * order when one exists. Used when a customer dismissed checkout and wants
 * to pay the same pending order again.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handleError, json, methodNotAllowed, readJson } from "../_lib/http";
import { enforceRateLimit } from "../_lib/rate-limit";
import { text } from "../_lib/validate";
import { createCheckoutSession, OrderError } from "../_lib/orders";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  if (!enforceRateLimit(req, res, "payment-create-order", 20, 60_000)) return;

  try {
    const body = await readJson(req);
    const orderNumber = text(body.orderNumber ?? body.orderId, 32);
    const customerCode = text(body.customerCode, 32).toUpperCase();
    if (!/^ORD-[A-Z0-9]{8}$/.test(orderNumber) || !/^3DP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(customerCode)) {
      fail(res, 400, "A valid order number and customer code are required.");
      return;
    }

    const result = await createCheckoutSession(orderNumber, customerCode);
    json(res, 200, { session: result.session });
  } catch (error) {
    if (error instanceof OrderError) {
      fail(res, error.status, error.message);
      return;
    }
    handleError(res, error, "POST /api/payments/create-order");
  }
}
