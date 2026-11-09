/**
 * Razorpay Checkout.js integration (TEST mode).
 * The server creates the Razorpay order and verifies the signature; this file
 * only opens the modal and forwards the callback fields.
 */

import { apiPost } from "./api";
import type { CheckoutSession, Order, RazorpayCallback } from "./types";

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayCallback) => void;
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
};

type RazorpayFailure = { error?: { description?: string; reason?: string } };

type RazorpayInstance = {
  open: () => void;
  close?: () => void;
  on?: (event: "payment.failed", callback: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Opens Checkout.js and resolves with the signed callback fields. */
export async function openRazorpayCheckout(input: {
  session: CheckoutSession;
  storeName: string;
  description: string;
}): Promise<RazorpayCallback> {
  const { session, storeName, description } = input;
  if (!session.razorpayOrderId || !session.keyId.startsWith("rzp_test_")) {
    throw new Error(
      "Razorpay TEST keys are not configured for this deployment. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  const loaded = await loadCheckout();
  if (!loaded || !window.Razorpay) {
    throw new Error("Could not load Razorpay Checkout. Check your connection and try again.");
  }

  return new Promise<RazorpayCallback>((resolve, reject) => {
    let settled = false;
    const instance = new window.Razorpay!({
      key: session.keyId,
      amount: session.amount,
      currency: session.currency,
      order_id: session.razorpayOrderId,
      name: storeName,
      description,
      prefill: {
        name: session.customerName,
        email: session.customerEmail,
        contact: session.customerPhone,
      },
      notes: { order_number: session.orderNumber },
      theme: { color: "#8b5cf6" },
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          if (!settled) reject(new Error("cancelled"));
        },
      },
    });

    instance.on?.("payment.failed", (response) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          response.error?.description || response.error?.reason || "Razorpay reported a failed payment.",
        ),
      );
    });

    instance.open();
  });
}

/** Server-side signature + amount verification. Returns the confirmed order. */
export async function verifyRazorpayPayment(
  callback: RazorpayCallback,
): Promise<Order> {
  const response = await apiPost<{ order: Order }>("/api/payments/verify", callback);
  return response.order;
}

/** Re-opens checkout for an existing pending order (safe retry). */
export async function createPaymentSession(orderNumber: string, customerCode: string): Promise<CheckoutSession> {
  const response = await apiPost<{ session: CheckoutSession }>("/api/payments/create-order", {
    orderNumber,
    customerCode,
  });
  return response.session;
}
