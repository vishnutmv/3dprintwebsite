/**
 * POST /api/payments/verify
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Signature is verified cryptographically, then the payment is re-fetched
 * from Razorpay to confirm the amount and order. Only then does the
 * SECURITY DEFINER mark_order_paid() RPC mark the order paid (idempotently).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, readJson } from "../_lib/http";
import { enforceRateLimit } from "../_lib/rate-limit";
import { text } from "../_lib/validate";
import { verifyCheckoutSignature, fetchRazorpayPayment } from "../_lib/razorpay";
import { getOrderByNumber } from "../_lib/orders";
import { getCustomerById } from "../_lib/customers";
import { notifyPaymentSuccess } from "../_lib/notify";
import { mapOrder, type OrderRow } from "../_lib/mapping";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  if (!enforceRateLimit(req, res, "payment-verify", 30, 60_000)) return;

  try {
    const body = await readJson(req);
    const razorpayOrderId = text(body.razorpay_order_id ?? body.orderId, 64);
    const razorpayPaymentId = text(body.razorpay_payment_id ?? body.paymentId, 64);
    const signature = text(body.razorpay_signature ?? body.signature, 256);

    if (!razorpayOrderId || !razorpayPaymentId || !signature) {
      fail(res, 400, "Payment details are incomplete.");
      return;
    }

    if (!verifyCheckoutSignature(razorpayOrderId, razorpayPaymentId, signature)) {
      console.warn("[payments] signature mismatch for Razorpay order", razorpayOrderId);
      fail(res, 400, "Payment signature did not match. The order has not been marked paid.");
      return;
    }

    // Find the Supabase order by the Razorpay order id stored at checkout.
    const { data: orderData, error: orderError } = await db()
      .from("orders")
      .select("*")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();
    if (orderError) throw new Error(`Order lookup failed: ${orderError.message}`);
    if (!orderData) {
      fail(res, 404, "Order not found for this payment.");
      return;
    }
    const order = orderData as OrderRow;

    // A previously verified payment is returned idempotently.
    if (order.payment_status === "paid") {
      const result = await getOrderByNumber(order.order_number);
      if (!result) {
        fail(res, 404, "Order not found.");
        return;
      }
      json(res, 200, {
        order: mapOrder(result.order, result.items, result.customer),
        duplicate: order.razorpay_payment_id !== razorpayPaymentId,
      });
      return;
    }

    // Never trust the browser: confirm the payment server-to-server.
    const payment = await fetchRazorpayPayment(razorpayPaymentId);
    if (payment.order_id !== razorpayOrderId) {
      fail(res, 400, "Payment belongs to a different order.");
      return;
    }
    if (payment.amount !== order.total_amount || payment.currency !== "INR") {
      console.warn("[payments] amount mismatch", {
        orderNumber: order.order_number,
        expected: order.total_amount,
        received: payment.amount,
      });
      fail(res, 400, "Payment amount does not match the stored order total.");
      return;
    }
    if (payment.status === "failed") {
      await db().rpc("mark_order_payment_failed", {
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
      });
      fail(res, 402, "Razorpay reports this payment as failed. Nothing was marked paid.");
      return;
    }
    if (!["captured", "authorized"].includes(payment.status)) {
      fail(res, 409, `Payment is not complete yet (status: ${payment.status}).`);
      return;
    }

    const { error: rpcError } = await db().rpc("mark_order_paid", {
      p_razorpay_order_id: razorpayOrderId,
      p_razorpay_payment_id: razorpayPaymentId,
    });
    if (rpcError) throw new Error(`Could not confirm payment: ${rpcError.message}`);

    const result = await getOrderByNumber(order.order_number);
    if (!result) {
      fail(res, 404, "Order not found after confirmation.");
      return;
    }

    const customer = result.customer ?? (await getCustomerById(order.customer_id));
    if (customer?.email) {
      await notifyPaymentSuccess({
        to: customer.email,
        orderNumber: result.order.order_number,
        customerCode: customer.customer_code,
        total: result.order.total_amount,
        paymentId: razorpayPaymentId,
      });
    }

    json(res, 200, {
      order: mapOrder(result.order, result.items, result.customer),
    });
  } catch (error) {
    handleError(res, error, "POST /api/payments/verify");
  }
}
