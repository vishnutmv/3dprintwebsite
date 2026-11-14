import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  PackageCheck,
  Search,
  Truck,
  X,
} from "lucide-react";
import { StatusPill } from "@/components/ui";
import {
  TRACKING_COURIERS,
  getOrders,
  updateOrderShipment,
  updateOrderStatus,
  type AdminOrder,
  type ShipmentUpdateResult,
} from "@/lib/admin";
import { cn, dateTime, inr } from "@/lib/format";
import { useToast } from "@/lib/toast";

const LAST_COURIER_KEY = "3dp-last-courier";
const filters = [
  { key: "all", label: "All" },
  { key: "needs", label: "Needs AWB" },
  { key: "transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
] as const;

type QueueFilter = (typeof filters)[number]["key"];

function hasTracking(order: AdminOrder): boolean {
  return Boolean(order.trackingNumber && order.courierSlug);
}

function isDelivered(order: AdminOrder): boolean {
  return order.orderStatus === "delivered";
}

function courierName(slug: string | null | undefined): string {
  return TRACKING_COURIERS.find((courier) => courier.slug === slug)?.name ?? slug?.toUpperCase() ?? "";
}

function shipmentLabel(order: AdminOrder): string {
  if (isDelivered(order)) return "Delivered";
  if (hasTracking(order)) return order.orderStatus === "shipped" ? "In transit" : "AWB added";
  return "Awaiting AWB";
}

export function AdminDispatch() {
  const toast = useToast((state) => state.push);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [lastSaved, setLastSaved] = useState<ShipmentUpdateResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getOrders();
      setOrders(result.filter((order) => order.orderStatus !== "cancelled"));
      setSelected((current) =>
        current ? result.find((order) => order.orderNumber === current.orderNumber) ?? null : null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the dispatch queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setCourier(selected.courierSlug ?? window.localStorage.getItem(LAST_COURIER_KEY) ?? "");
    setTracking(selected.trackingNumber ?? "");
    setLastSaved(null);
  }, [selected?.orderNumber]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      needs: orders.filter((order) => !hasTracking(order) && !isDelivered(order)).length,
      transit: orders.filter((order) => hasTracking(order) && !isDelivered(order)).length,
      delivered: orders.filter(isDelivered).length,
    }),
    [orders],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter === "needs" && (hasTracking(order) || isDelivered(order))) return false;
      if (filter === "transit" && (!hasTracking(order) || isDelivered(order))) return false;
      if (filter === "delivered" && !isDelivered(order)) return false;
      if (!needle) return true;
      return `${order.orderNumber} ${order.customerName} ${order.phone} ${order.customerCode} ${order.trackingNumber ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, orders, query]);

  const saveTracking = async () => {
    if (!selected) return;
    if (!courier || !tracking.trim()) {
      toast("Choose a courier and enter the AWB / tracking number.", "warn");
      return;
    }
    setSavingTracking(true);
    try {
      const result = await updateOrderShipment(selected.orderNumber, {
        courier,
        trackingNumber: tracking.trim(),
      });
      window.localStorage.setItem(LAST_COURIER_KEY, courier);
      setOrders((current) =>
        current.map((order) => (order.orderNumber === result.order.orderNumber ? result.order : order)),
      );
      setSelected(result.order);
      setLastSaved(result);
      const { notifications } = result;
      if (notifications.email === "failed" || notifications.whatsapp === "failed") {
        toast("Tracking saved, but one customer notification failed.", "warn");
      } else if (notifications.email === "unchanged" && notifications.whatsapp === "unchanged") {
        toast("Tracking saved. That AWB was already on record, so no duplicate alert was sent.", "success");
      } else {
        toast("Tracking saved. The customer was notified in-app" +
          (notifications.email !== "not_configured" && notifications.email !== "unchanged" ? ", by email" : "") +
          (notifications.whatsapp !== "not_configured" && notifications.whatsapp !== "unchanged" ? " and on WhatsApp" : "") +
          ".", "success");
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not save the tracking number.", "error");
    } finally {
      setSavingTracking(false);
    }
  };

  const moveStatus = async (status: "shipped" | "delivered") => {
    if (!selected) return;
    if (status === "shipped" && !hasTracking(selected)) {
      toast("Save the courier and AWB before marking this order shipped.", "warn");
      return;
    }
    setSavingStatus(true);
    try {
      const { order, notifications } = await updateOrderStatus(selected.orderNumber, status);
      setOrders((current) =>
        current.map((item) => (item.orderNumber === order.orderNumber ? order : item)),
      );
      setSelected(order);
      if (status === "delivered") {
        toast("Order delivered. The customer has been notified and the order is closed.", "success");
      } else if (notifications.whatsapp === "failed") {
        toast("Marked shipped, but the WhatsApp update failed.", "warn");
      } else {
        toast("Order marked shipped. The customer has been notified.", "success");
      }
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not update the order status.", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Fulfilment</p>
          <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Dispatch & tracking</h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            Add the courier and AWB once a parcel is handed over. The customer receives the tracking details and can
            follow the order in their profile.
          </p>
        </div>
        <button type="button" className="btn-glass" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
          Refresh queue
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Orders", value: counts.all, hint: "Not cancelled", icon: Truck, tone: "text-violet-300" },
          { label: "Needs AWB", value: counts.needs, hint: "Waiting for courier details", icon: MapPin, tone: "text-sun" },
          { label: "In transit", value: counts.transit, hint: "Tracking added", icon: PackageCheck, tone: "text-violet-300" },
          { label: "Delivered", value: counts.delivered, hint: "Completed", icon: CheckCircle2, tone: "text-mint" },
        ].map((card) => (
          <div key={card.label} className="glass rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">{card.label}</p>
              <card.icon className={cn("h-4 w-4", card.tone)} />
            </div>
            <p className="num mt-2 text-[24px] font-bold tracking-[-0.03em] text-white">{card.value}</p>
            <p className="mt-0.5 text-[10.5px] text-white/35">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="glass mt-4 grid gap-2 rounded-2xl p-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order, customer, phone or AWB"
            className="field pl-9"
            aria-label="Search dispatch queue"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.03] p-1">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition",
                filter === item.key ? "bg-violet-500/30 text-white" : "text-white/50 hover:text-white",
              )}
            >
              {item.label}
              <span className="ml-1.5 text-[9.5px] text-white/35">{counts[item.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      <div className="glass mt-4 overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Order status</th>
                <th className="px-5 py-3 font-semibold">Courier / AWB</th>
                <th className="px-5 py-3 font-semibold">Shipment</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[12px] text-white/45">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading dispatch queue…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[12px] text-white/45">
                    {query.trim() ? "No orders match that search." : "No orders in this stage yet."}
                  </td>
                </tr>
              ) : (
                visible.map((order) => (
                  <tr
                    key={order.orderNumber}
                    onClick={() => setSelected(order)}
                    className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono text-[11.5px] text-white/75">{order.orderNumber}</p>
                      <p className="mt-0.5 text-[10.5px] text-white/35">{dateTime(order.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-white/80">{order.customerName}</p>
                      <p className="mt-0.5 font-mono text-[10.5px] text-white/35">{order.phone}</p>
                    </td>
                    <td className="px-5 py-3"><StatusPill status={order.orderStatus} /></td>
                    <td className="px-5 py-3">
                      {hasTracking(order) ? (
                        <>
                          <p className="text-white/75">{courierName(order.courierSlug)}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-violet-200">{order.trackingNumber}</p>
                        </>
                      ) : (
                        <span className="text-white/35">Not added</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                          isDelivered(order)
                            ? "bg-mint/15 text-mint"
                            : hasTracking(order)
                              ? "bg-violet-500/15 text-violet-200"
                              : "bg-sun/15 text-sun",
                        )}
                      >
                        {shipmentLabel(order)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-[11.5px] font-semibold text-violet-300">
                        {hasTracking(order) ? "Update tracking" : "Add tracking"} →
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-ink-950/70 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="glass-deep h-full w-full max-w-[470px] overflow-y-auto p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Dispatch order</p>
                <p className="num mt-1 text-[16px] font-semibold text-white">{selected.orderNumber}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{dateTime(selected.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Close dispatch order"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill status={selected.paymentStatus} />
              <StatusPill status={selected.orderStatus} />
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                  isDelivered(selected)
                    ? "bg-mint/15 text-mint"
                    : hasTracking(selected)
                      ? "bg-violet-500/15 text-violet-200"
                      : "bg-sun/15 text-sun",
                )}
              >
                {shipmentLabel(selected)}
              </span>
            </div>

            {selected.paymentStatus !== "paid" && (
              <p className="mt-4 rounded-xl border border-sun/25 bg-sun/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-sun">
                Payment is still {selected.paymentStatus}. Only dispatch once the payment is verified.
              </p>
            )}

            <div className="mt-5">
              <p className="label">Deliver to</p>
              <p className="text-[12.5px] leading-relaxed text-white/65">
                {selected.customerName}
                <br />
                {selected.address}
                <br />
                {selected.city}, {selected.state} {selected.pin}
                <br />
                {selected.phone}
                {selected.email ? <><br />{selected.email}</> : null}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-500/10 p-3.5">
              <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-violet-200/80">
                <Truck className="h-3.5 w-3.5" /> Courier tracking
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-violet-100/70">
                Saving an AWB sends the courier details to the customer in their profile, by email and on WhatsApp when
                those channels are configured.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="dispatch-courier">Courier</label>
                  <select
                    id="dispatch-courier"
                    className="field"
                    value={courier}
                    onChange={(event) => setCourier(event.target.value)}
                  >
                    <option value="">Select courier</option>
                    {TRACKING_COURIERS.map((item) => (
                      <option key={item.slug} value={item.slug} className="bg-ink-900">{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="dispatch-awb">AWB / tracking number</label>
                  <input
                    id="dispatch-awb"
                    className="field font-mono uppercase"
                    value={tracking}
                    onChange={(event) => setTracking(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                    placeholder="e.g. D123456789"
                    autoComplete="off"
                  />
                </div>
              </div>
              {selected.trackingSyncedAt && (
                <p className="mt-2 text-[10.5px] text-white/35">
                  Live provider last checked {dateTime(selected.trackingSyncedAt)}
                </p>
              )}
              {lastSaved?.tracking && (
                <p className="mt-2 text-[10.5px] text-mint/80">
                  {lastSaved.tracking.statusLabel}
                  {lastSaved.tracking.mostRecentStatus ? ` · ${lastSaved.tracking.mostRecentStatus}` : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary !px-3.5 !py-2 text-[11.5px]"
                  disabled={savingTracking}
                  onClick={() => void saveTracking()}
                >
                  {savingTracking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                  {hasTracking(selected) ? "Update tracking" : "Save tracking"} & notify client
                </button>
              </div>
            </div>

            <div className="mt-5">
              <p className="label">Move the order</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-glass !justify-center !py-2.5 text-[12px]"
                  disabled={savingStatus || isDelivered(selected) || selected.orderStatus === "shipped"}
                  onClick={() => void moveStatus("shipped")}
                >
                  {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                  Mark shipped
                </button>
                <button
                  type="button"
                  className="btn-primary !justify-center !py-2.5 text-[12px]"
                  disabled={savingStatus || isDelivered(selected)}
                  onClick={() => void moveStatus("delivered")}
                >
                  {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Mark delivered
                </button>
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/35">
                Delivering closes the order, alerts the customer and sends a delivery alert to the studio. Courier
                updates can also close the order automatically when live tracking is enabled.
              </p>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="label">Items</p>
              <div className="grid gap-2">
                {selected.items.map((item) => (
                  <div key={`${selected.orderNumber}-${item.productId || item.name}`} className="flex justify-between gap-2 text-[12.5px]">
                    <span className="text-white/70">
                      {item.name} <span className="text-white/35">× {item.qty}</span>
                    </span>
                    <span className="num text-white/85">{inr(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-white/8 pt-2 text-[12.5px] font-semibold text-white">
                <span>Total</span>
                <span className="num">{inr(selected.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
