/**
 * POST /api/admin/prizes/assign
 * Body: { prizeId, customerId (code or UUID), notes? }
 *
 * Manual assignment only — there is no automatic draw. Records the
 * assignment in customer_prizes, marks the prize awarded, and attempts the
 * configured notification channel, storing the real delivery status.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { isUuid, text } from "../../_lib/validate";
import { getCustomerByCode } from "../../_lib/customers";
import { notifyPrizeAssigned } from "../../_lib/notify";
import type { CustomerRow, PrizeRow } from "../../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    const body = await readJson(req);
    const prizeId = text(body.prizeId, 64);
    const customerRef = text(body.customerId, 64).toUpperCase();
    const notes = text(body.notes, 500);

    if (!isUuid(prizeId)) {
      fail(res, 400, "Select a valid prize.");
      return;
    }
    if (!customerRef) {
      fail(res, 400, "Select a customer.");
      return;
    }

    const { data: prizeData, error: prizeError } = await db()
      .from("prizes")
      .select("*")
      .eq("id", prizeId)
      .maybeSingle();
    if (prizeError) throw new Error(`Prize lookup failed: ${prizeError.message}`);
    if (!prizeData) {
      fail(res, 404, "Prize not found.");
      return;
    }
    const prize = prizeData as PrizeRow;
    if (!prize.is_active || prize.status !== "open") {
      fail(res, 409, "This prize has already been awarded. Release it first.");
      return;
    }

    let customer: CustomerRow | null = null;
    if (isUuid(customerRef)) {
      const { data } = await db().from("customers").select("*").eq("id", customerRef).maybeSingle();
      customer = (data as CustomerRow | null) ?? null;
    } else {
      customer = await getCustomerByCode(customerRef);
    }
    if (!customer) {
      fail(res, 404, "Customer not found. Check the customer code.");
      return;
    }

    const { error: assignmentError } = await db().rpc("assign_prize_to_customer", {
      p_prize_id: prize.id,
      p_customer_id: customer.id,
      p_assigned_by: session.email,
      p_notes: notes || null,
    });
    if (assignmentError) {
      if (assignmentError.message.includes("customer_not_eligible")) {
        fail(res, 409, "This customer has no paid orders and is not eligible for assignment.");
        return;
      }
      if (assignmentError.message.includes("prize_not_available")) {
        fail(res, 409, "This prize is no longer available.");
        return;
      }
      throw new Error(`Could not record assignment: ${assignmentError.message}`);
    }

    const { data: assignment, error: assignmentLookupError } = await db()
      .from("customer_prizes")
      .select("*")
      .eq("prize_id", prize.id)
      .is("released_at", null)
      .single();
    if (assignmentLookupError) throw new Error(`Could not load assignment: ${assignmentLookupError.message}`);

    const notificationStatus = customer.email
      ? await notifyPrizeAssigned({
          to: customer.email,
          phone: customer.phone,
          customerCode: customer.customer_code,
          prizeTitle: prize.title,
          voucherCode: prize.voucher_code,
        })
      : "not_configured";

    const { error: notificationUpdateError } = await db()
      .from("customer_prizes")
      .update({ notification_status: notificationStatus })
      .eq("id", assignment.id);
    if (notificationUpdateError) {
      throw new Error(`Could not record notification status: ${notificationUpdateError.message}`);
    }

    json(res, 201, {
      assignment: {
        id: assignment.id,
        prizeId: prize.id,
        prizeTitle: prize.title,
        customerId: customer.customer_code,
        customerName: customer.full_name,
        customerEmail: customer.email ?? "",
        assignedBy: session.email,
        notificationStatus,
        assignedAt: assignment.assigned_at,
        notes,
      },
    });
  } catch (error) {
    handleError(res, error, "POST /api/admin/prizes/assign");
  }
}
