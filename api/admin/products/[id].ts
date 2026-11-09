/**
 * PATCH  /api/admin/products/:id — update fields
 * DELETE /api/admin/products/:id — soft delete (is_active = false)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, pathParam, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { adminProduct, type ProductRow } from "../../_lib/mapping";
import { parseProductPayload } from "../../_lib/product-payload";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    methodNotAllowed(res, ["PATCH", "DELETE"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  const id = pathParam(req, "id");
  if (!id) {
    fail(res, 400, "Product id is required.");
    return;
  }

  try {
    const { data: existing, error: lookupError } = await db()
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw new Error(`Product lookup failed: ${lookupError.message}`);
    if (!existing) {
      fail(res, 404, "Product not found.");
      return;
    }
    const current = existing as ProductRow;

    if (req.method === "DELETE") {
      const { error } = await db()
        .from("products")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw new Error(`Could not deactivate product: ${error.message}`);
      json(res, 200, { ok: true, deactivated: true });
      return;
    }

    const body = await readJson(req);
    const parsed = parseProductPayload(body, true);
    if ("error" in parsed) {
      fail(res, 400, parsed.error);
      return;
    }
    const values = parsed.values;
    const nextPrice = values.price ?? current.price;
    const nextMrp = values.mrp !== undefined ? values.mrp : current.mrp;
    if (nextMrp != null && nextMrp < nextPrice) {
      fail(res, 400, "MRP must be greater than or equal to the selling price.");
      return;
    }

    const { data, error } = await db()
      .from("products")
      .update(values)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        fail(res, 409, "That product slug already exists.");
        return;
      }
      throw new Error(`Could not update product: ${error.message}`);
    }

    json(res, 200, { product: adminProduct(data as ProductRow) });
  } catch (error) {
    handleError(res, error, "admin/products/:id");
  }
}
