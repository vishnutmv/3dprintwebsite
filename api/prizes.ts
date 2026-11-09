/**
 * GET /api/prizes — active, still-open prizes (safe public fields only).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_lib/supabase";
import { handleError, json, methodNotAllowed } from "./_lib/http";
import { publicPrize, type PrizeRow } from "./_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  try {
    const { data, error } = await db()
      .from("prizes")
      .select("*")
      .eq("is_active", true)
      .eq("status", "open")
      .order("worth", { ascending: false });
    if (error) throw new Error(`Could not load prizes: ${error.message}`);

    json(res, 200, { prizes: ((data ?? []) as PrizeRow[]).map(publicPrize) });
  } catch (error) {
    handleError(res, error, "GET /api/prizes");
  }
}
