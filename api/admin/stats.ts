/**
 * GET /api/admin/stats — dashboard aggregates from Supabase.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/supabase";
import { handleError, json, methodNotAllowed } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    const client = db();

    const [productsRes, customersRes, ordersRes, pendingRes, prizesRes] = await Promise.all([
      client.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      client.from("customers").select("id", { count: "exact", head: true }),
      client.from("orders").select("id", { count: "exact", head: true }),
      client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "pending"),
      client
        .from("prizes")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("is_active", true),
    ]);

    for (const result of [productsRes, customersRes, ordersRes, pendingRes, prizesRes]) {
      if (result.error) throw new Error(result.error.message);
    }

    const { data: paidPayments, error: paymentError } = await client
      .from("payments")
      .select("amount")
      .eq("status", "paid");
    if (paymentError) throw new Error(paymentError.message);
    const revenue = (paidPayments ?? []).reduce(
      (sum, row) => sum + Number((row as { amount: number }).amount),
      0,
    );

    const { data: lowStock, error: stockError } = await client
      .from("products")
      .select("id,name,stock_quantity,category")
      .eq("is_active", true)
      .lte("stock_quantity", 10)
      .order("stock_quantity", { ascending: true })
      .limit(5);
    if (stockError) throw new Error(stockError.message);

    const { data: recent, error: recentError } = await client
      .from("orders")
      .select(
        "order_number,total_amount,payment_status,order_status,created_at,customers(full_name,city)",
      )
      .order("created_at", { ascending: false })
      .limit(8);
    if (recentError) throw new Error(recentError.message);

    json(res, 200, {
      revenue,
      orderCount: ordersRes.count ?? 0,
      customers: customersRes.count ?? 0,
      products: productsRes.count ?? 0,
      pendingOrders: pendingRes.count ?? 0,
      openPrizes: prizesRes.count ?? 0,
      lowStock: (lowStock ?? []).map((row) => {
        const product = row as unknown as {
          id: string;
          name: string;
          stock_quantity: number;
          category: string;
        };
        return {
          id: product.id,
          name: product.name,
          stock: product.stock_quantity,
          category: product.category,
        };
      }),
      recent: (recent ?? []).map((row) => {
        const order = row as unknown as {
          order_number: string;
          total_amount: number;
          payment_status: string;
          order_status: string;
          created_at: string;
          customers: { full_name: string; city: string } | null;
        };
        return {
          id: order.order_number,
          customerName: order.customers?.full_name ?? "",
          city: order.customers?.city ?? "",
          total: order.total_amount,
          status: order.order_status,
          paymentStatus: order.payment_status,
          createdAt: order.created_at,
        };
      }),
    });
  } catch (error) {
    handleError(res, error, "GET /api/admin/stats");
  }
}
