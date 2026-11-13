import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Download, Loader2, Lock, RefreshCw } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { apiGet, apiPost } from "@/lib/api";
import { fullDateTime, inr } from "@/lib/format";
import {
  createPaymentSession,
  openRazorpayCheckout,
  verifyRazorpayPayment,
} from "@/lib/razorpay";
import {
  orderAccessCode,
  rememberCustomerCode,
  rememberOrderCode,
} from "@/lib/customer";
import { demoMode } from "@/lib/demo-mode";
import { createInvoicePdf, invoicePdfBase64 } from "@/lib/invoice";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

const notices: Record<string, string> = {
  cancelled: "Payment window closed. Your order is saved as pending — use the button below to pay.",
  failed: "The payment did not complete. The order remains unpaid until Razorpay confirms a payment.",
  pending: "Payment is still pending. The order is only marked paid after server-side verification.",
  demo: "Demo order saved in this browser only. No payment was taken and the order will not be fulfilled.",
};

export function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const clearCart = useStore((state) => state.clearCart);
  const settings = useStore((state) => state.settings);

  const orderNumber = id ?? "";
  const code = (params.get("code") ?? orderAccessCode(orderNumber)).toUpperCase();
  const noticeKey = params.get("notice") ?? "";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [invoiceSending, setInvoiceSending] = useState(false);
  const invoiceAttempted = useRef(false);

  const load = useCallback(async () => {
    if (!orderNumber) {
      setLoading(false);
      setError("No order number was supplied.");
      return;
    }
    if (!code) {
      setLoading(false);
      setError("A customer code is required to open this order. Use the link from checkout.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<{ order: Order }>(
        `/api/orders/${encodeURIComponent(orderNumber)}?code=${encodeURIComponent(code)}`,
      );
      setOrder(response.order);
      rememberOrderCode(response.order.orderNumber, code);
      rememberCustomerCode(code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load order details.");
    } finally {
      setLoading(false);
    }
  }, [orderNumber, code]);

  useEffect(() => {
    void load();
  }, [load]);

  const emailInvoice = useCallback(async (currentOrder: Order) => {
    if (!code || currentOrder.paymentStatus !== "paid") return;
    setInvoiceSending(true);
    setInvoiceStatus("Preparing your PDF invoice…");
    try {
      const pdf = createInvoicePdf(currentOrder);
      const request = {
        orderNumber: currentOrder.orderNumber,
        customerCode: code,
        pdfBase64: invoicePdfBase64(pdf),
      };
      const [emailResult, whatsappResult] = await Promise.allSettled([
        apiPost<{ sent: boolean }>("/api/invoices/send", request),
        apiPost<{ sent: boolean }>("/api/invoices/whatsapp", request),
      ]);
      const emailMessage = emailResult.status === "fulfilled"
        ? `email sent to ${currentOrder.email || "your checkout email"}`
        : `email failed: ${emailResult.reason instanceof Error ? emailResult.reason.message : "delivery error"}`;
      const whatsappMessage = whatsappResult.status === "fulfilled"
        ? "WhatsApp PDF sent"
        : `WhatsApp failed: ${whatsappResult.reason instanceof Error ? whatsappResult.reason.message : "delivery error"}`;
      setInvoiceStatus(`Invoice ${emailMessage}; ${whatsappMessage}.`);
    } catch (caught) {
      setInvoiceStatus(caught instanceof Error ? caught.message : "The invoice email could not be sent.");
    } finally {
      setInvoiceSending(false);
    }
  }, [code]);

  useEffect(() => {
    if (!order || order.paymentStatus !== "paid" || demoMode || invoiceAttempted.current) return;
    invoiceAttempted.current = true;
    void emailInvoice(order);
  }, [emailInvoice, order]);

  const retryPayment = async () => {
    if (!order) return;
    setPayError("");
    setPaying(true);
    try {
      const session = await createPaymentSession(order.orderNumber, code);
      const callback = await openRazorpayCheckout({
        session,
        storeName: settings.storeName,
        description: `Order ${order.orderNumber}`,
      });
      const updated = await verifyRazorpayPayment(callback);
      setOrder(updated);
      clearCart();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Payment could not be completed.";
      setPayError(message === "cancelled" ? "Payment window closed. The order is still unpaid." : message);
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mx-auto mb-4 h-5 w-32 animate-pulse rounded bg-white/5" />
        <p className="text-sm text-white/50">Loading your order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-white">{orderNumber || "Order not found"}</h1>
        <p className="mt-2 text-sm text-coral">{error || "We could not find that order."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/account" className="btn-primary">Open my account</Link>
          <Link to="/shop" className="btn-glass">Back to shop</Link>
        </div>
      </div>
    );
  }

  const paid = order.paymentStatus === "paid";
  const canRetry = !paid && order.orderStatus !== "cancelled" && settings.paymentsReady;
  const notice = noticeKey ? notices[noticeKey] : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border p-6 md:p-8"
        style={{ background: "rgba(15,10,25,0.6)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusPill status={order.paymentStatus} />
              <StatusPill status={order.orderStatus} />
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-white">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-white/40">
              {fullDateTime(order.createdAt)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">Customer ID</p>
            <p className="num mt-1 font-mono text-[13px] text-violet-200">{order.customerCode}</p>
          </div>
        </div>

        {notice && (
          <p className="mb-5 rounded-xl border border-sun/25 bg-sun/[0.07] px-3 py-2.5 text-[11.5px] leading-relaxed text-sun/90">
            {notice}
          </p>
        )}

        {paid ? (
          <p className="mb-5 rounded-xl border border-mint/25 bg-mint/[0.06] px-3 py-2.5 text-[11.5px] text-mint">
            Payment verified by the server. Your order is confirmed.
          </p>
        ) : (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11.5px] leading-relaxed text-white/50">
            {order.orderStatus === "cancelled"
              ? "This order was cancelled."
              : demoMode
                ? "This sample order is stored only in this browser. It is not sent to a store and will not be fulfilled."
                : "This order is not paid yet. It is saved centrally and visible to the studio, but will only be marked paid after Razorpay's signature is verified on the server."}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-white/6 bg-white/[0.02] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Shipping to</h2>
          <div className="space-y-1 text-sm text-white/90">
            <div className="font-medium text-white">{order.customerName}</div>
            <div className="font-mono text-white/60">{order.phone}</div>
            {order.email && <div className="text-white/60">{order.email}</div>}
            <div>{order.address}</div>
            <div className="flex justify-between">
              <span>{order.city}</span>
              <span className="text-white/40">{order.state}</span>
            </div>
            <div className="text-white/60">PIN: {order.pin}</div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-white/6 bg-white/[0.02] p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Products</h2>
          <div className="divide-y divide-white/5">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.productId}`} className="flex items-center gap-3 py-2">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    style={{ background: "rgba(0,0,0,0.3)" }}
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-white/20">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{item.name}</div>
                  <div className="mt-0.5 text-xs text-white/40">
                    Qty: {item.qty} · {inr(item.price)} each
                  </div>
                </div>
                <div className="shrink-0 text-sm font-medium text-white">{inr(item.price * item.qty)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-white/6 bg-white/[0.02] p-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-white/50">Subtotal</span>
            <span className="text-white">{inr(order.subtotal)}</span>
          </div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-white/50">Shipping</span>
            <span className="text-white">{order.shipping === 0 ? "Free" : inr(order.shipping)}</span>
          </div>
          <div className="flex justify-between border-t border-white/5 pt-2 text-sm">
            <span className="font-medium text-white/70">Total</span>
            <span className="text-lg font-semibold text-white">{inr(order.total)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-white/5 px-2 py-1 text-white/60">
              Payment: {order.paymentStatus}
            </span>
            {order.paymentId && (
              <span className="rounded-lg bg-white/5 px-2 py-1 font-mono text-white/60">{order.paymentId}</span>
            )}
            <span className="rounded-lg bg-white/5 px-2 py-1 text-white/60">Razorpay test mode</span>
          </div>
        </div>

        {payError && (
          <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
            {payError}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {paid && (
            <button
              type="button"
              onClick={() => createInvoicePdf(order).save(`invoice-${order.orderNumber}.pdf`)}
              className="btn-glass"
            >
              <Download className="h-4 w-4" /> Download invoice PDF
            </button>
          )}
          {canRetry && (
            <button
              type="button"
              onClick={() => void retryPayment()}
              disabled={paying}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}
            >
              {paying ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay…</span>
              ) : (
                <span className="inline-flex items-center gap-2"><Lock className="h-4 w-4" /> Pay {inr(order.total)}</span>
              )}
            </button>
          )}
          <Link to="/shop" className="btn-glass">Continue shopping</Link>
          <Link
            to="/account"
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white/80 transition-all hover:text-white"
          >
            My orders
          </Link>
        </div>
        {paid && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/45">
            <span>{invoiceSending ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}{invoiceStatus || "Preparing invoice email…"}</span>
            {invoiceStatus && !invoiceStatus.startsWith("Invoice email sent") && (
            <button type="button" onClick={() => void emailInvoice(order)} disabled={invoiceSending} className="text-violet-200 underline underline-offset-2 disabled:opacity-50">
                Retry invoice delivery
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
