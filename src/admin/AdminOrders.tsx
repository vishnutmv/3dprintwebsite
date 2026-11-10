import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search, X } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { dateTime, inr } from "@/lib/format";
import { useToast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import {
  getOrders,
  updateOrderStatus,
  type AdminOrder,
} from "@/lib/admin";
import { WhatsAppChat } from "./WhatsAppChat";

const paymentFilters = ["all", "pending", "paid", "failed", "refunded"];
const orderFilters = [
  "all",
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
];

const statusActions = ["pending", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled"];

export function AdminOrders() {
  const toast = useToast((state) => state.push);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getOrders({
        paymentStatus: paymentFilter,
        orderStatus: statusFilter,
        q: query,
      });
      setOrders(result);
      setSelected((current) =>
        current ? result.find((order) => order.orderNumber === current.orderNumber) ?? null : null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [paymentFilter, statusFilter, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const counts = useMemo(
    () => ({
      paid: orders.filter((order) => order.paymentStatus === "paid").length,
      pending: orders.filter((order) => order.paymentStatus === "pending").length,
      failed: orders.filter((order) => order.paymentStatus === "failed").length,
    }),
    [orders],
  );

  const applyStatus = async (order: AdminOrder, status: string) => {
    setSavingStatus(true);
    try {
      const updated = await updateOrderStatus(order.orderNumber, status);
      setOrders((current) =>
        current.map((item) => (item.orderNumber === updated.orderNumber ? updated : item)),
      );
      setSelected(updated);
      toast(`${updated.orderNumber} → ${status}`);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not update status", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  const exportCsv = () => {
    downloadCsv("3dprintco-orders.csv", [
      ["Order", "Placed", "Customer ID", "Customer", "Phone", "City", "Total (INR)", "Payment", "Order status", "Payment ID"],
      ...orders.map((order) => [
        order.orderNumber,
        dateTime(order.createdAt),
        order.customerCode,
        order.customerName,
        order.phone,
        order.city,
        (order.total / 100).toFixed(2),
        order.paymentStatus,
        order.orderStatus,
        order.paymentId ?? "",
      ]),
    ]);
    toast("Orders exported");
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Fulfilment</p>
          <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Orders</h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {orders.length} shown · {counts.paid} paid · {counts.pending} pending · {counts.failed} failed
          </p>
        </div>
        <button type="button" className="btn-glass" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="glass mb-4 grid gap-2 rounded-2xl p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order number, customer, phone or customer ID"
            className="field pl-9"
            aria-label="Search orders"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(event) => setPaymentFilter(event.target.value)}
          className="field w-full capitalize lg:w-[180px]"
          aria-label="Filter by payment status"
        >
          {paymentFilters.map((status) => (
            <option key={status} value={status} className="bg-ink-900">Payment: {status}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="field w-full capitalize lg:w-[190px]"
          aria-label="Filter by order status"
        >
          {orderFilters.map((status) => (
            <option key={status} value={status} className="bg-ink-900">Order: {status}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-5 py-3 font-semibold">Placed</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Customer ID</th>
                <th className="px-5 py-3 text-right font-semibold">Total</th>
                <th className="px-5 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 font-semibold">Order</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[12px] text-white/45">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading orders…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-[12px] text-white/45">
                    No orders match these filters yet.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.orderNumber}
                    onClick={() => setSelected(order)}
                    className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-5 py-3 font-mono text-[11.5px] text-white/75">{order.orderNumber}</td>
                    <td className="px-5 py-3 text-[11.5px] text-white/45">{dateTime(order.createdAt)}</td>
                    <td className="px-5 py-3 text-white/80">{order.customerName}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-violet-200/80">{order.customerCode}</td>
                    <td className="num px-5 py-3 text-right text-white/85">{inr(order.total)}</td>
                    <td className="px-5 py-3"><StatusPill status={order.paymentStatus} /></td>
                    <td className="px-5 py-3"><StatusPill status={order.orderStatus} /></td>
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
            className="glass-deep h-full w-full max-w-[460px] overflow-y-auto p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Order</p>
                <p className="num mt-1 text-[16px] font-semibold text-white">{selected.orderNumber}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{dateTime(selected.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Close order"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill status={selected.paymentStatus} />
              <StatusPill status={selected.orderStatus} />
            </div>

            <div className="mt-4 rounded-2xl border border-violet-300/25 bg-violet-500/10 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-200/70">Customer ID</p>
              <p className="num mt-1 font-mono text-[15px] font-semibold text-violet-100">{selected.customerCode}</p>
            </div>

            <div className="mt-4">
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

            <WhatsAppChat name={selected.customerName} phone={selected.phone} />

            <div className="mt-4">
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
            </div>

            <div className="mt-4 grid gap-1.5 border-t border-white/10 pt-3 text-[12.5px]">
              <div className="flex justify-between text-white/50">
                <span>Subtotal</span>
                <span className="num">{inr(selected.subtotal)}</span>
              </div>
              <div className="flex justify-between text-white/50">
                <span>Shipping</span>
                <span className="num">{selected.shipping === 0 ? "Free" : inr(selected.shipping)}</span>
              </div>
              <div className="flex justify-between pt-1 font-semibold text-white">
                <span>Total</span>
                <span className="num">{inr(selected.total)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/45">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/35">Razorpay</p>
              <p className="mt-1.5 font-mono text-white/60">Order: {selected.razorpayOrderId ?? "—"}</p>
              <p className="font-mono text-white/60">Payment: {selected.paymentId ?? "—"}</p>
              <p className="mt-1.5">
                Payment status is controlled only by verified Razorpay callbacks or the signed webhook.
              </p>
            </div>

            <div className="mt-5">
              <p className="label">Update order status</p>
              <div className="flex flex-wrap gap-2">
                {statusActions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={savingStatus}
                    onClick={() => void applyStatus(selected, status)}
                    className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold capitalize transition disabled:opacity-50 ${
                      selected.orderStatus === status
                        ? "border-transparent bg-violet-400 text-ink-950"
                        : "border-white/12 bg-white/[0.04] text-white/60 hover:text-white"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
