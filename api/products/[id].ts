/**
 * GET /api/products/:id
 * `id` may be the product slug (storefront) or its UUID.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, pathParam } from "../_lib/http";
import { publicProduct, type ProductRow } from "../_lib/mapping";
import { isUuid } from "../_lib/validate";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  const id = pathParam(req, "id");
  if (!id) {
    fail(res, 400, "Product id is required.");
    return;
  }

  try {
    const { data, error } = await db()
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq(isUuid(id) ? "id" : "slug", id)
      .maybeSingle();
    if (error) throw new Error(`Could not load product: ${error.message}`);
    if (!data) {
      fail(res, 404, "Product not found.");
      return;
    }
    res.setHeader("cache-control", "public, max-age=30, stale-while-revalidate=120");
    json(res, 200, { product: publicProduct(data as ProductRow) });
  } catch (error) {
    handleError(res, error, "GET /api/products/:id");
  }
}
