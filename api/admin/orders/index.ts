/**
 * GET /api/admin/orders
 * Filters: ?paymentStatus=paid&orderStatus=pending&q=search
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { handleError, json, methodNotAllowed, queryString } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import {
  mapOrder,
  type CustomerRow,
  type OrderItemRow,
  type OrderRow,
} from "../../_lib/mapping";

const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

type OrderWithCustomer = OrderRow & { customers: CustomerRow | null };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    const paymentStatus = queryString(req, "paymentStatus");
    const orderStatus = queryString(req, "orderStatus");
    const search = queryString(req, "q").replace(/[%,()]/g, " ").slice(0, 80);

    let customerIds: string[] = [];
    if (search) {
      const { data: matches, error: matchError } = await db()
        .from("customers")
        .select("id")
        .or(
          `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%`,
        )
        .limit(200);
      if (matchError) throw new Error(`Customer search failed: ${matchError.message}`);
      customerIds = (matches ?? []).map((row) => (row as { id: string }).id);
    }

    let query = db()
      .from("orders")
      .select("*, customers(*)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (PAYMENT_STATUSES.includes(paymentStatus)) query = query.eq("payment_status", paymentStatus);
    if (ORDER_STATUSES.includes(orderStatus)) query = query.eq("order_status", orderStatus);

    if (search) {
      const parts = [`order_number.ilike.%${search}%`];
      if (customerIds.length > 0) parts.push(`customer_id.in.(${customerIds.join(",")})`);
      query = query.or(parts.join(","));
    }

    const { data, error } = await query;
    if (error) throw new Error(`Could not load orders: ${error.message}`);

    const orders = (data ?? []) as unknown as OrderWithCustomer[];
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
      orders: orders.map((order) =>
        mapOrder(
          order,
          items.filter((item) => item.order_id === order.id),
          order.customers,
        ),
      ),
    });
  } catch (error) {
    handleError(res, error, "GET /api/admin/orders");
  }
}
