/**
 * POST /api/orders
 * Body: { contact: {...}, items: [{ productId, quantity }] }
 *
 * 1. Recalculates every price/subtotal/shipping/total from Supabase.
 * 2. Reuses or creates the customer record.
 * 3. Saves a pending order + item snapshots.
 * 4. Creates the Razorpay TEST order and returns the checkout session.
 *
 * The browser-submitted amount is never trusted — it is not even read.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handleError, json, methodNotAllowed, readJson } from "../_lib/http";
import { enforceRateLimit } from "../_lib/rate-limit";
import { parseContact } from "../_lib/validate";
import { createCheckoutSession, createPendingOrder, OrderError } from "../_lib/orders";
import { notifyOrderCreated } from "../_lib/notify";
import { mapOrder, type CustomerRow, type OrderItemRow, type OrderRow } from "../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  if (!enforceRateLimit(req, res, "order-create", 20, 60_000)) return;

  try {
    const body = await readJson(req);
    const parsedContact = parseContact(body.contact ?? body);
    if ("error" in parsedContact) {
      fail(res, 400, parsedContact.error);
      return;
    }

    const pending = await createPendingOrder({
      contact: parsedContact.contact,
      items: body.items,
    });

    const session = await createCheckoutSession(pending.order.order_number);

    await notifyOrderCreated({
      to: parsedContact.contact.email,
      orderNumber: pending.order.order_number,
      customerCode: pending.customer.customer_code,
      total: pending.order.total_amount,
    });

    json(res, 201, {
      order: mapOrder(
        pending.order as OrderRow,
        pending.items as OrderItemRow[],
        pending.customer as CustomerRow,
      ),
      session: session.session,
    });
  } catch (error) {
    if (error instanceof OrderError) {
      fail(res, error.status, error.message);
      return;
    }
    handleError(res, error, "POST /api/orders");
  }
}
