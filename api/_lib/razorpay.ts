/**
 * Razorpay server integration (TEST mode only).
 * Uses Razorpay's REST API with Basic auth; secrets stay on the server.
 */

import crypto from "node:crypto";
import { razorpayEnv } from "./env";

const API_BASE = "https://api.razorpay.com/v1";

function authHeader(): string {
  const { keyId, keySecret } = razorpayEnv();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

export async function createRazorpayOrder(input: {
  amount: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  razorpayEnv();
  const response = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader() },
    body: JSON.stringify({
      amount: input.amount,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Razorpay order creation failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return (await response.json()) as RazorpayOrder;
}

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method?: string;
};

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  razorpayEnv();
  const response = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: authHeader() },
  });

  if (!response.ok) {
    throw new Error(`Razorpay payment lookup failed (${response.status}).`);
  }
  return (await response.json()) as RazorpayPayment;
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Verifies the checkout callback signature: HMAC_SHA256(order_id|payment_id). */
export function verifyCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const { keySecret } = razorpayEnv();
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

/** Verifies the X-Razorpay-Signature header over the raw webhook body. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
