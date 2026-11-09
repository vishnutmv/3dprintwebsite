/**
 * GET /api/admin/customers?q=
 * Customer codes, contact details and aggregates computed from orders.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { handleError, json, methodNotAllowed, queryString } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import type { CustomerRow } from "../../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    const search = queryString(req, "q").replace(/[%,()]/g, " ").slice(0, 80);

    let query = db()
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%`,
      );
    }

    const { data: customersData, error: customerError } = await query;
    if (customerError) throw new Error(`Could not load customers: ${customerError.message}`);
    const customers = (customersData ?? []) as CustomerRow[];

    const { data: ordersData, error: orderError } = await db()
      .from("orders")
      .select("customer_id,total_amount,payment_status,order_status");
    if (orderError) throw new Error(`Could not load orders: ${orderError.message}`);
    const orders = (ordersData ?? []) as unknown as {
      customer_id: string;
      total_amount: number;
      payment_status: string;
      order_status: string;
    }[];

    json(res, 200, {
      customers: customers.map((customer) => {
        const mine = orders.filter((order) => order.customer_id === customer.id);
        const live = mine.filter((order) => order.order_status !== "cancelled");
        const spend = mine
          .filter((order) => order.payment_status === "paid")
          .reduce((sum, order) => sum + order.total_amount, 0);
        const paidOrders = mine.filter((order) => order.payment_status === "paid").length;
        return {
          id: customer.customer_code,
          customerCode: customer.customer_code,
          name: customer.full_name,
          fullName: customer.full_name,
          email: customer.email ?? "",
          phone: customer.phone,
          city: customer.city ?? "",
          state: customer.state ?? "",
          postalCode: customer.postal_code ?? "",
          address: customer.delivery_address ?? "",
          orders: live.length,
          paidOrders,
          spend,
          joinedAt: customer.created_at,
        };
      }),
    });
  } catch (error) {
    handleError(res, error, "GET /api/admin/customers");
  }
}
