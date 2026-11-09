/**
 * GET  /api/admin/products  — all products (including inactive)
 * POST /api/admin/products  — create a product
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { adminProduct, type ProductRow } from "../../_lib/mapping";
import { parseProductPayload } from "../../_lib/product-payload";
import { slugify } from "../../_lib/validate";

async function uniqueSlug(base: string): Promise<string> {
  const clean = slugify(base) || `product-${Date.now()}`;
  let candidate = clean;
  let suffix = 2;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data, error } = await db()
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(`Slug check failed: ${error.message}`);
    if (!data) return candidate;
    candidate = `${clean}-${suffix}`;
    suffix += 1;
  }
  return `${clean}-${Date.now()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    methodNotAllowed(res, ["GET", "POST"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const { data, error } = await db()
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Could not load products: ${error.message}`);
      json(res, 200, {
        products: ((data ?? []) as ProductRow[]).map(adminProduct),
      });
      return;
    }

    const body = await readJson(req);
    const parsed = parseProductPayload(body, false);
    if ("error" in parsed) {
      fail(res, 400, parsed.error);
      return;
    }
    const values = parsed.values;
    if (values.price === undefined) {
      fail(res, 400, "Price is required.");
      return;
    }
    if (values.mrp != null && values.mrp < values.price) {
      fail(res, 400, "MRP must be greater than or equal to the selling price.");
      return;
    }

    const slug = await uniqueSlug(values.slug ?? values.name ?? "");

    const { data, error } = await db()
      .from("products")
      .insert({
        slug,
        name: values.name ?? "",
        description: values.description ?? "",
        price: values.price,
        mrp: values.mrp ?? null,
        category: values.category ?? "Uncategorised",
        stock_quantity: values.stock_quantity ?? 0,
        images: values.images ?? [],
        video_url: values.video_url ?? null,
        specifications: values.specifications ?? {},
        material: values.material ?? "",
        dimensions: values.dimensions ?? "",
        print_time: values.print_time ?? "",
        badge: values.badge ?? null,
        variant: values.variant ?? "lattice",
        accent: values.accent ?? "#a78bfa",
        model_url: values.model_url ?? null,
        rating: values.rating ?? 0,
        reviews: values.reviews ?? 0,
        is_active: values.is_active ?? true,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        fail(res, 409, "That product slug already exists.");
        return;
      }
      throw new Error(`Could not create product: ${error.message}`);
    }

    json(res, 201, { product: adminProduct(data as ProductRow) });
  } catch (error) {
    handleError(res, error, "admin/products");
  }
}

