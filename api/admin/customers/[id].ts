/**
 * GET /api/admin/customers/:id  (UUID or customer code)
 * Customer profile plus full order history for the admin CRM.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, pathParam } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { isUuid } from "../../_lib/validate";
import {
  mapOrder,
  type CustomerRow,
  type OrderItemRow,
  type OrderRow,
} from "../../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  const id = pathParam(req, "id");
  if (!id) {
    fail(res, 400, "Customer id is required.");
    return;
  }

  try {
    const { data: customerData, error: customerError } = await db()
      .from("customers")
      .select("*")
      .eq(isUuid(id) ? "id" : "customer_code", id.toUpperCase())
      .maybeSingle();
    if (customerError) throw new Error(`Customer lookup failed: ${customerError.message}`);
    if (!customerData) {
      fail(res, 404, "Customer not found.");
      return;
    }
    const customer = customerData as CustomerRow;

    const { data: ordersData, error: orderError } = await db()
      .from("orders")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    if (orderError) throw new Error(`Order history failed: ${orderError.message}`);
    const orders = (ordersData ?? []) as OrderRow[];

    let items: OrderItemRow[] = [];
    if (orders.length > 0) {
      const { data: itemData, error: itemError } = await db()
        .from("order_items")
        .select("*")
        .in("order_id", orders.map((order) => order.id));
      if (itemError) throw new Error(`Order items failed: ${itemError.message}`);
      items = (itemData ?? []) as OrderItemRow[];
    }

    const spend = orders
      .filter((order) => order.payment_status === "paid")
      .reduce((sum, order) => sum + order.total_amount, 0);

    json(res, 200, {
      customer: {
        id: customer.customer_code,
        customerCode: customer.customer_code,
        name: customer.full_name,
        fullName: customer.full_name,
        email: customer.email ?? "",
        phone: customer.phone,
        address: customer.delivery_address ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        postalCode: customer.postal_code ?? "",
        joinedAt: customer.created_at,
        orders: orders.filter((order) => order.order_status !== "cancelled").length,
        paidOrders: orders.filter((order) => order.payment_status === "paid").length,
        spend,
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
    handleError(res, error, "GET /api/admin/customers/:id");
  }
}
