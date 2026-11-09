/**
 * GET /api/orders/:orderNumber?code=CUSTOMER_CODE
 *
 * An order can only be read with the matching customer code, so the order
 * number alone is not enough to expose a customer's address or history.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handleError, json, methodNotAllowed, pathParam, queryString } from "../_lib/http";
import { enforceRateLimit } from "../_lib/rate-limit";
import { getOrderByNumber } from "../_lib/orders";
import { mapOrder } from "../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  if (!enforceRateLimit(req, res, "order-read", 60, 60_000)) return;

  const orderNumber = pathParam(req, "id");
  const code = queryString(req, "code").toUpperCase();
  if (!orderNumber) {
    fail(res, 400, "Order number is required.");
    return;
  }
  if (!code) {
    fail(res, 403, "A customer code is required to view this order.");
    return;
  }

  try {
    const result = await getOrderByNumber(orderNumber);
    // Same response for "missing" and "wrong code" so orders cannot be probed.
    if (!result || !result.customer || result.customer.customer_code.toUpperCase() !== code) {
      fail(res, 404, "Order not found.");
      return;
    }
    json(res, 200, {
      order: mapOrder(result.order, result.items, result.customer),
    });
  } catch (error) {
    handleError(res, error, "GET /api/orders/:id");
  }
}
