/**
 * ReceiptModal — read the order receipt on the web, in the same layout used
 * for the downloadable PDF invoice.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Download, ReceiptText, X } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { fullDateTime, inr } from "@/lib/format";
import { createInvoicePdf } from "@/lib/invoice";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";

export function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const settings = useStore((state) => state.settings);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="receipt-backdrop fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto p-4 py-8 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt for ${order.orderNumber}`}
        className="glass w-full max-w-[640px] rounded-[1.75rem] p-5 md:p-7"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-violet-300">Order receipt</p>
            <h2 className="mt-1 text-[24px]">{settings.storeName || "3D Print Co."}</h2>
            <p className="mt-1 text-[11.5px] text-white/45">
              {[settings.city, settings.supportEmail].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label="Close receipt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
          <div>
            <p className="font-mono text-[12.5px] font-semibold text-violet-200">{order.orderNumber}</p>
            <p className="mt-0.5 text-[10.5px] text-white/40">{fullDateTime(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={order.paymentStatus} />
            <StatusPill status={order.orderStatus} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Billed to</p>
            <p className="mt-1 text-[12.5px] font-semibold text-white/85">{order.customerName}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
              {order.phone}
              {order.email ? <><br />{order.email}</> : null}
              <br />Customer ID {order.customerCode}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Delivered to</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/55">
              {order.address}
              <br />
              {[order.city, order.state, order.pin].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/8">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-white/8 bg-white/[0.03] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="min-w-[72px] text-right">Amount</span>
          </div>
          <div className="divide-y divide-white/5">
            {order.items.map((item) => (
              <div key={`${order.id}-${item.productId}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-white/80">{item.name}</p>
                  <p className="mt-0.5 text-[10px] text-white/35">{inr(item.price)} each</p>
                </div>
                <span className="num text-right text-[11.5px] text-white/55">{item.qty}</span>
                <span className="num min-w-[72px] text-right text-[12px] font-semibold text-white/85">
                  {inr(item.price * item.qty)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 ml-auto w-full max-w-[280px] space-y-1.5 text-[12px]">
          <div className="flex justify-between text-white/50">
            <span>Subtotal</span>
            <span className="num text-white/80">{inr(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-white/50">
            <span>Shipping</span>
            <span className="num text-white/80">{order.shipping === 0 ? "Free" : inr(order.shipping)}</span>
          </div>
          <div className="flex justify-between border-t border-white/8 pt-2 text-[13px]">
            <span className="font-semibold text-white/75">Total paid</span>
            <span className="num font-bold text-white">{inr(order.total)}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
          <div className="text-[10.5px] leading-relaxed text-white/35">
            <p className="flex items-center gap-1.5"><ReceiptText className="h-3.5 w-3.5" /> Computer-generated receipt</p>
            {order.paymentId && <p className="mt-1 font-mono">Payment ID {order.paymentId}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !px-4 !py-2 text-[11.5px]"
              onClick={() => createInvoicePdf(order).save(`invoice-${order.orderNumber}.pdf`)}
            >
              <Download className="h-3.5 w-3.5" /> Download PDF
            </button>
            <button type="button" className="btn-glass !px-4 !py-2 text-[11.5px]" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
