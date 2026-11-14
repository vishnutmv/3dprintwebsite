import { useCallback, useEffect, useState } from "react";
import { Check, CircleDot, Loader2, MapPin, RefreshCw, Truck } from "lucide-react";
import { apiGet } from "@/lib/api";
import { cn, dateTime } from "@/lib/format";
import type { Order, OrderTracking } from "@/lib/types";

type Stage = { key: string; label: string; hint: string; done: boolean; active: boolean };

function stagesFor(order: Order, tracking: OrderTracking | null): Stage[] {
  const status = order.orderStatus;
  const paid = order.paymentStatus === "paid";
  const shipped = Boolean(tracking?.configured) || status === "shipped" || status === "delivered";
  const delivered = status === "delivered" || tracking?.state === "delivered";
  const packed = delivered || shipped || status === "packed";
  const confirmed = paid || status !== "pending";
  return [
    { key: "placed", label: "Order placed", hint: dateTime(order.createdAt), done: true, active: !confirmed },
    {
      key: "confirmed",
      label: paid ? "Payment confirmed" : "Order confirmed",
      hint: paid ? "Razorpay verified the payment." : "Waiting for payment confirmation.",
      done: confirmed,
      active: confirmed && !packed,
    },
    {
      key: "packed",
      label: "Packed",
      hint: packed ? "Your prints are packed for dispatch." : "Being printed and packed.",
      done: packed,
      active: packed && !shipped,
    },
    {
      key: "shipped",
      label: "Shipped",
      hint: tracking?.configured
        ? `${tracking.courierName} · ${tracking.trackingNumber}`
        : "The courier and AWB appear here after handover.",
      done: shipped,
      active: shipped && !delivered,
    },
    {
      key: "delivered",
      label: "Delivered",
      hint: delivered ? "Delivered. Thank you!" : tracking?.estimatedDelivery ? `Expected ${dateTime(`${tracking.estimatedDelivery}T12:00:00Z`).split(",")[0]}` : "Awaiting the courier's final update.",
      done: delivered,
      active: delivered,
    },
  ];
}

export function OrderTracker({ order }: { order: Order }) {
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError("");
      try {
        const response = await apiGet<{ tracking: OrderTracking }>(
          `/api/customer/orders/${encodeURIComponent(order.orderNumber)}/tracking${refresh ? "?refresh=1" : ""}`,
        );
        setTracking(response.tracking);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load courier updates.");
      } finally {
        setLoading(false);
      }
    },
    [order.orderNumber],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the timeline live while the order is open and the parcel is moving.
  useEffect(() => {
    if (!tracking?.configured || tracking.state === "delivered" || order.orderStatus === "delivered") return;
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load, order.orderStatus, tracking?.configured, tracking?.state]);

  if (order.orderStatus === "cancelled") {
    return (
      <div className="rounded-2xl border border-coral/25 bg-coral/[0.07] px-4 py-3 text-[11.5px] text-coral">
        This order was cancelled. Contact the store if you were charged.
      </div>
    );
  }

  const stages = stagesFor(order, tracking);
  const checkpoints = tracking?.checkpoints ? [...tracking.checkpoints].reverse() : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">Order progress</p>
        <ol className="mt-3 space-y-0">
          {stages.map((stage, index) => (
            <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
              {index < stages.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[9px] top-5 h-full w-px",
                    stage.done ? "bg-mint/40" : "bg-white/12",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border",
                  stage.done
                    ? "border-transparent bg-mint text-ink-950"
                    : stage.active
                      ? "border-violet-300/60 bg-violet-400/20 text-violet-200"
                      : "border-white/15 bg-white/[0.04] text-white/25",
                )}
              >
                {stage.done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : stage.active ? (
                  <Truck className="h-3 w-3" />
                ) : (
                  <CircleDot className="h-2.5 w-2.5" />
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[12.5px] font-semibold", stage.done || stage.active ? "text-white" : "text-white/45")}>
                  {stage.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">{stage.hint}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">
              Live courier updates
            </p>
            {tracking?.configured ? (
              <p className="mt-1 truncate text-[12.5px] font-semibold text-white">
                {tracking.courierName || tracking.courier} ·{" "}
                <span className="font-mono text-[11.5px] text-violet-200">{tracking.trackingNumber}</span>
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-white/50">Not handed to a courier yet.</p>
            )}
          </div>
          {tracking?.configured && (
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="shrink-0 rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Refresh courier updates"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          )}
        </div>

        {loading && !tracking ? (
          <p className="mt-4 flex items-center gap-2 text-[11.5px] text-white/45">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the courier…
          </p>
        ) : error ? (
          <div className="mt-3">
            <p className="text-[11.5px] text-coral">{error}</p>
            <button type="button" className="mt-2 text-[11px] text-white/60 underline" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : tracking ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-violet-200">
                {tracking.statusLabel}
              </span>
              {tracking.estimatedDelivery && (
                <span className="text-[10.5px] text-white/45">ETA {tracking.estimatedDelivery}</span>
              )}
              {tracking.stale && <span className="text-[10.5px] text-sun/80">Showing last known update</span>}
            </div>

            {tracking.mostRecentStatus && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-white/60">{tracking.mostRecentStatus}</p>
            )}
            {tracking.message && <p className="mt-2 text-[11px] leading-relaxed text-white/40">{tracking.message}</p>}

            {checkpoints.length > 0 ? (
              <ul className="mt-3 space-y-2.5 border-t border-white/8 pt-3">
                {checkpoints.map((checkpoint, index) => (
                  <li key={`${checkpoint.at}-${index}`} className="flex gap-2">
                    <MapPin className={cn("mt-0.5 h-3 w-3 shrink-0", index === 0 ? "text-mint" : "text-white/25")} />
                    <div className="min-w-0">
                      <p className={cn("text-[11.5px] leading-snug", index === 0 ? "text-white/85" : "text-white/55")}>
                        {checkpoint.status}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/30">
                        {[checkpoint.location, checkpoint.at ? dateTime(checkpoint.at) : ""].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 border-t border-white/8 pt-3 text-[11px] text-white/35">
                {tracking.configured
                  ? "The courier has no scan yet. This refreshes automatically."
                  : "Add the courier and AWB in the admin panel to start live updates."}
              </p>
            )}

            {tracking.syncedAt && (
              <p className="mt-3 text-[9.5px] text-white/25">Last checked {dateTime(tracking.syncedAt)}</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
