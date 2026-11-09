/**
 * GET /api/customers/:code/orders — order history for one customer code.
 * The customer code is a 64-bit-ish random identifier issued at first order.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, pathParam } from "../../_lib/http";
import { enforceRateLimit } from "../../_lib/rate-limit";
import { getCustomerByCode } from "../../_lib/customers";
import { mapOrder, type OrderItemRow, type OrderRow } from "../../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  if (!enforceRateLimit(req, res, "customer-orders", 30, 60_000)) return;

  const code = pathParam(req, "code").toUpperCase();
  if (!/^3DP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    fail(res, 404, "Customer not found.");
    return;
  }

  try {
    const customer = await getCustomerByCode(code);
    if (!customer) {
      fail(res, 404, "Customer not found.");
      return;
    }

    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`Could not load orders: ${error.message}`);

    const orders = (data ?? []) as OrderRow[];
    let items: OrderItemRow[] = [];
    if (orders.length > 0) {
      const { data: itemRows, error: itemError } = await db()
        .from("order_items")
        .select("*")
        .in("order_id", orders.map((order) => order.id));
      if (itemError) throw new Error(`Could not load order items: ${itemError.message}`);
      items = (itemRows ?? []) as OrderItemRow[];
    }

    json(res, 200, {
      customer: {
        code: customer.customer_code,
        name: customer.full_name,
        email: customer.email,
        phone: customer.phone,
      },
      orders: orders.map((order) =>
        mapOrder(
          order,
          items.filter((item) => item.order_id === order.id),
          customer,
        ),
      ),
    });
  } catch (error) {
    handleError(res, error, "GET /api/customers/:code/orders");
  }
}
