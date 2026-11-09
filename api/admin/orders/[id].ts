/**
 * PATCH /api/admin/orders/:orderNumber  { orderStatus }
 * Payment status is never set manually here — only verified payments do that.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, pathParam, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { text } from "../../_lib/validate";
import { notifyOrderStatus } from "../../_lib/notify";
import {
  mapOrder,
  type CustomerRow,
  type OrderItemRow,
  type OrderRow,
} from "../../_lib/mapping";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "PATCH") {
    methodNotAllowed(res, ["PATCH"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  const orderNumber = pathParam(req, "id");
  if (!orderNumber) {
    fail(res, 400, "Order number is required.");
    return;
  }

  try {
    const body = await readJson(req);
    const status = text(body.orderStatus ?? body.status, 20);
    if (!ORDER_STATUSES.includes(status)) {
      fail(res, 400, "Unknown order status.");
      return;
    }

    const { data, error } = await db()
      .from("orders")
      .update({ order_status: status })
      .eq("order_number", orderNumber)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(`Could not update order: ${error.message}`);
    if (!data) {
      fail(res, 404, "Order not found.");
      return;
    }
    const order = data as OrderRow;

    const [{ data: customerData }, { data: itemData }] = await Promise.all([
      db().from("customers").select("*").eq("id", order.customer_id).maybeSingle(),
      db().from("order_items").select("*").eq("order_id", order.id),
    ]);
    const customer = (customerData as CustomerRow | null) ?? null;

    if (customer?.email) {
      await notifyOrderStatus({
        to: customer.email,
        orderNumber: order.order_number,
        status,
      });
    }

    json(res, 200, {
      order: mapOrder(order, (itemData ?? []) as OrderItemRow[], customer),
    });
  } catch (error) {
    handleError(res, error, "PATCH /api/admin/orders/:id");
  }
}
