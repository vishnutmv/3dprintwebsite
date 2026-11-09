/**
 * GET  /api/admin/prizes — prizes plus manual assignment history
 * POST /api/admin/prizes — create a prize or voucher
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { parsePrizePayload } from "../../_lib/prize-payload";
import { mapPrize, type CustomerPrizeRow, type PrizeRow } from "../../_lib/mapping";

type AssignmentWithCustomer = CustomerPrizeRow & {
  released_at: string | null;
  customers: { customer_code: string; full_name: string; email: string | null } | null;
  prizes: { title: string } | null;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    methodNotAllowed(res, ["GET", "POST"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const [prizesRes, assignmentsRes] = await Promise.all([
        db().from("prizes").select("*").order("created_at", { ascending: false }),
        db()
          .from("customer_prizes")
          .select("*, customers(customer_code,full_name,email), prizes(title)")
          .order("assigned_at", { ascending: false }),
      ]);
      if (prizesRes.error) throw new Error(prizesRes.error.message);
      if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);

      const prizes = (prizesRes.data ?? []) as PrizeRow[];
      const assignments = (assignmentsRes.data ?? []) as unknown as AssignmentWithCustomer[];
      const assignmentsByPrize = new Map<string, AssignmentWithCustomer>();
      for (const assignment of assignments) {
        if (!assignment.released_at && !assignmentsByPrize.has(assignment.prize_id)) {
          assignmentsByPrize.set(assignment.prize_id, assignment);
        }
      }

      json(res, 200, {
        prizes: prizes.map((row) => {
          const assignment = assignmentsByPrize.get(row.id);
          return {
            ...mapPrize(row),
            awardedTo: assignment?.customers?.customer_code ?? undefined,
            awardedToName: assignment?.customers?.full_name ?? undefined,
            awardedAt: assignment?.assigned_at ?? undefined,
            notificationStatus: assignment?.notification_status ?? undefined,
          };
        }),
        assignments: assignments.map((assignment) => ({
          id: assignment.id,
          prizeId: assignment.prize_id,
          prizeTitle: assignment.prizes?.title ?? "",
          customerId: assignment.customers?.customer_code ?? "",
          customerName: assignment.customers?.full_name ?? "",
          customerEmail: assignment.customers?.email ?? "",
          assignedBy: assignment.assigned_by,
          notificationStatus: assignment.notification_status,
          assignedAt: assignment.assigned_at,
          releasedAt: assignment.released_at ?? undefined,
          notes: assignment.notes ?? "",
        })),
      });
      return;
    }

    const body = await readJson(req);
    const parsed = parsePrizePayload(body, false);
    if ("error" in parsed) {
      fail(res, 400, parsed.error);
      return;
    }
    const values = parsed.values;

    const { data, error } = await db()
      .from("prizes")
      .insert({
        title: values.title ?? "",
        description: values.description ?? "",
        prize_type: values.prize_type ?? "regular",
        voucher_code: values.voucher_code ?? null,
        worth: values.worth ?? 0,
        sponsor: values.sponsor ?? "",
        cycle: values.cycle ?? "",
        media_urls: values.media_urls ?? [],
        is_active: values.is_active ?? true,
        status: "open",
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        fail(res, 409, "That voucher code already exists.");
        return;
      }
      throw new Error(`Could not create prize: ${error.message}`);
    }

    json(res, 201, { prize: mapPrize(data as PrizeRow) });
  } catch (error) {
    handleError(res, error, "admin/prizes");
  }
}
