/**
 * GET /api/products
 * Public, active-only catalogue. Supports ?category= and ?q=.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/supabase";
import { handleError, json, methodNotAllowed, queryString } from "../_lib/http";
import { publicProduct, type ProductRow } from "../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    let query = db()
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const category = queryString(req, "category");
    if (category && category !== "All") query = query.eq("category", category);

    const search = queryString(req, "q");
    if (search) {
      const safe = search.replace(/[%,()]/g, " ").slice(0, 80);
      query = query.or(`name.ilike.%${safe}%,category.ilike.%${safe}%,description.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Could not load products: ${error.message}`);

    const products = ((data ?? []) as ProductRow[]).map(publicProduct);
    res.setHeader("cache-control", "public, max-age=30, stale-while-revalidate=120");
    json(res, 200, { products });
  } catch (error) {
    handleError(res, error, "GET /api/products");
  }
}
