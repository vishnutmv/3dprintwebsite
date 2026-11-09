/**
 * POST /api/payments/webhook
 *
 * Razorpay webhook safety net for payment confirmation. The raw body is
 * required for HMAC verification, so Vercel body parsing is disabled.
 * Processing is idempotent via mark_order_paid().
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/supabase";
import { handleError, readRawBody } from "../_lib/http";
import { verifyWebhookSignature } from "../_lib/razorpay";
import { webhookSecret } from "../_lib/env";
import { getCustomerById } from "../_lib/customers";
import { notifyPaymentSuccess } from "../_lib/notify";
import type { OrderRow } from "../_lib/mapping";

export const config = { api: { bodyParser: false } };

type WebhookPayment = {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  captured?: boolean;
};

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: WebhookPayment };
    order?: { entity?: { id?: string; amount?: number; status?: string } };
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const secret = webhookSecret();
    if (!secret) {
      // Refuse rather than accept unverifiable payment events.
      res.status(503).json({ error: "Webhook secret is not configured." });
      return;
    }

    const signatureHeader = req.headers["x-razorpay-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader ?? "";
    const rawBody = await readRawBody(req);

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      res.status(400).json({ error: "Invalid webhook signature." });
      return;
    }

    const payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload;
    const event = payload.event ?? "";
    const payment = payload.payload?.payment?.entity ?? null;

    if (event === "payment.failed" && payment?.order_id) {
      await db().rpc("mark_order_payment_failed", {
        p_razorpay_order_id: payment.order_id,
        p_razorpay_payment_id: payment.id ?? null,
      });
      res.status(200).json({ received: true });
      return;
    }

    const isPaidEvent = event === "payment.captured" || event === "order.paid";
    if (!isPaidEvent) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    const razorpayOrderId = payment?.order_id ?? payload.payload?.order?.entity?.id ?? "";
    const razorpayPaymentId = payment?.id ?? "";
    if (!razorpayOrderId) {
      res.status(200).json({ received: true, ignored: "missing_order_id" });
      return;
    }

    const { data: orderData, error: orderError } = await db()
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();
    if (orderError) throw new Error(`Webhook order lookup failed: ${orderError.message}`);
    if (!orderData) {
      res.status(200).json({ received: true, ignored: "unknown_order" });
      return;
    }
    const order = orderData as OrderRow;

    const paidAmount = payment?.amount ?? payload.payload?.order?.entity?.amount ?? 0;
    if (paidAmount !== order.total_amount) {
      console.warn("[webhook] amount mismatch", {
        orderNumber: order.order_number,
        expected: order.total_amount,
        received: paidAmount,
      });
      res.status(200).json({ received: true, ignored: "amount_mismatch" });
      return;
    }

    const paymentId = razorpayPaymentId || order.razorpay_payment_id;
    if (!paymentId) {
      res.status(200).json({ received: true, ignored: "missing_payment_id" });
      return;
    }

    const wasPaid = order.payment_status === "paid";
    const { error: rpcError } = await db().rpc("mark_order_paid", {
      p_razorpay_order_id: razorpayOrderId,
      p_razorpay_payment_id: paymentId,
    });
    if (rpcError) throw new Error(`Webhook payment confirmation failed: ${rpcError.message}`);

    if (!wasPaid) {
      const customer = await getCustomerById(order.customer_id);
      if (customer?.email) {
        await notifyPaymentSuccess({
          to: customer.email,
          orderNumber: order.order_number,
          customerCode: customer.customer_code,
          total: order.total_amount,
          paymentId,
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON payload." });
      return;
    }
    handleError(res, error, "POST /api/payments/webhook");
  }
}
