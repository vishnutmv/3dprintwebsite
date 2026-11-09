/**
 * Configurable customer notifications.
 *
 * Nothing here pretends delivery works: when credentials are absent the
 * result is "not_configured" and the admin UI reports that clearly.
 *
 * Supported providers:
 *   - Email: Resend (RESEND_API_KEY + NOTIFY_FROM)
 *   - Generic webhook: NOTIFY_WEBHOOK_URL (POST JSON, e.g. WhatsApp relay)
 */

import { notificationEnv } from "./env";

export type NotificationStatus = "sent" | "failed" | "not_configured";

type Message = {
  to: string;
  subject: string;
  text: string;
  event: string;
  metadata?: Record<string, unknown>;
};

export async function sendNotification(message: Message): Promise<NotificationStatus> {
  const { resendApiKey, from, webhookUrl } = notificationEnv();

  if (!resendApiKey && !webhookUrl) {
    console.info(`[notify] skipped (${message.event}) — no notification provider configured.`);
    return "not_configured";
  }

  let delivered = false;

  if (resendApiKey && from && message.to) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      if (response.ok) delivered = true;
      else console.error(`[notify] Resend returned ${response.status}: ${await response.text()}`);
    } catch (error) {
      console.error("[notify] Resend request failed:", error);
    }
  }

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: message.event,
          to: message.to,
          subject: message.subject,
          text: message.text,
          metadata: message.metadata ?? {},
        }),
      });
      if (response.ok) delivered = true;
      else console.error(`[notify] webhook returned ${response.status}`);
    } catch (error) {
      console.error("[notify] webhook request failed:", error);
    }
  }

  return delivered ? "sent" : "failed";
}

export function notificationCapabilities(): { email: boolean; webhook: boolean } {
  const { resendApiKey, from, webhookUrl } = notificationEnv();
  return { email: Boolean(resendApiKey && from), webhook: Boolean(webhookUrl) };
}

export async function notifyOrderCreated(input: {
  to: string;
  orderNumber: string;
  customerCode: string;
  total: number;
}): Promise<NotificationStatus> {
  return sendNotification({
    to: input.to,
    event: "order.created",
    subject: `Order ${input.orderNumber} received`,
    text: [
      `Thanks for your order.`,
      ``,
      `Order: ${input.orderNumber}`,
      `Customer ID: ${input.customerCode}`,
      `Total: ₹${(input.total / 100).toFixed(2)}`,
      ``,
      `We will email you again as soon as Razorpay confirms the payment.`,
      `— 3D Print Co.`,
    ].join("\n"),
    metadata: { orderNumber: input.orderNumber },
  });
}

export async function notifyPaymentSuccess(input: {
  to: string;
  orderNumber: string;
  customerCode: string;
  total: number;
  paymentId: string;
}): Promise<NotificationStatus> {
  return sendNotification({
    to: input.to,
    event: "payment.success",
    subject: `Payment confirmed — ${input.orderNumber}`,
    text: [
      `Payment confirmed. Your order is now being prepared.`,
      ``,
      `Order: ${input.orderNumber}`,
      `Customer ID: ${input.customerCode}`,
      `Paid: ₹${(input.total / 100).toFixed(2)}`,
      `Razorpay payment: ${input.paymentId}`,
      ``,
      `— 3D Print Co.`,
    ].join("\n"),
    metadata: { orderNumber: input.orderNumber, paymentId: input.paymentId },
  });
}

export async function notifyOrderStatus(input: {
  to: string;
  orderNumber: string;
  status: string;
}): Promise<NotificationStatus> {
  return sendNotification({
    to: input.to,
    event: "order.status",
    subject: `Order ${input.orderNumber} is now ${input.status}`,
    text: [
      `Your order status changed to: ${input.status}.`,
      ``,
      `Order: ${input.orderNumber}`,
      `— 3D Print Co.`,
    ].join("\n"),
    metadata: { orderNumber: input.orderNumber, status: input.status },
  });
}

export async function notifyPrizeAssigned(input: {
  to: string;
  phone: string;
  customerCode: string;
  prizeTitle: string;
  voucherCode: string | null;
}): Promise<NotificationStatus> {
  return sendNotification({
    to: input.to,
    event: "prize.assigned",
    subject: `You won: ${input.prizeTitle}`,
    text: [
      `Congratulations — you have been awarded: ${input.prizeTitle}.`,
      ``,
      `Customer ID: ${input.customerCode}`,
      input.voucherCode ? `Voucher code: ${input.voucherCode}` : "",
      ``,
      `Reply to this message within 7 days to claim.`,
      `— 3D Print Co.`,
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: { prizeTitle: input.prizeTitle, phone: input.phone },
  });
}
