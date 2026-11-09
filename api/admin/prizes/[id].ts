/**
 * PATCH  /api/admin/prizes/:id — edit prize, set status (open releases assignment)
 * DELETE /api/admin/prizes/:id — deactivate a prize without deleting its history
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, pathParam, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { parsePrizePayload } from "../../_lib/prize-payload";
import { mapPrize, type PrizeRow } from "../../_lib/mapping";
import { isUuid } from "../../_lib/validate";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    methodNotAllowed(res, ["PATCH", "DELETE"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  const id = pathParam(req, "id");
  if (!isUuid(id)) {
    fail(res, 400, "A valid prize id is required.");
    return;
  }

  try {
    if (req.method === "DELETE") {
      const { data, error } = await db()
        .from("prizes")
        .update({ is_active: false })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(`Could not delete prize: ${error.message}`);
      if (!data) {
        fail(res, 404, "Prize not found.");
        return;
      }
      json(res, 200, { ok: true });
      return;
    }

    const body = await readJson(req);
    const parsed = parsePrizePayload(body, true);
    if ("error" in parsed) {
      fail(res, 400, parsed.error);
      return;
    }
    const values = parsed.values;

    if (values.status === "open") {
      const { error: releaseError } = await db().rpc("release_prize_assignment", {
        p_prize_id: id,
      });
      if (releaseError) throw new Error(`Could not release prize: ${releaseError.message}`);
      delete values.status;
    }

    if (Object.keys(values).length === 0) {
      const { data, error } = await db().from("prizes").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Could not load prize: ${error.message}`);
      if (!data) {
        fail(res, 404, "Prize not found.");
        return;
      }
      json(res, 200, { prize: mapPrize(data as PrizeRow) });
      return;
    }

    const { data, error } = await db()
      .from("prizes")
      .update(values)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") {
        fail(res, 409, "That voucher code already exists.");
        return;
      }
      throw new Error(`Could not update prize: ${error.message}`);
    }
    if (!data) {
      fail(res, 404, "Prize not found.");
      return;
    }

    json(res, 200, { prize: mapPrize(data as PrizeRow) });
  } catch (error) {
    handleError(res, error, "admin/prizes/:id");
  }
}
