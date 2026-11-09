import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Download, Loader2, PackagePlus, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { inr, shortDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { demoMode } from "@/lib/demo-mode";
import { useToast } from "@/lib/toast";
import { getOrders, getStats, type AdminStats } from "@/lib/admin";

export function Dashboard() {
  const toast = useToast((state) => state.push);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getStats();
        if (active) setStats(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load the dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const exportOrders = async () => {
    setExporting(true);
    try {
      const orders = await getOrders();
      downloadCsv("3dprintco-orders.csv", [
        ["Order", "Date", "Customer ID", "Customer", "City", "Items", "Total (INR)", "Payment", "Order status"],
        ...orders.map((order) => [
          order.orderNumber,
          shortDate(order.createdAt),
          order.customerCode,
          order.customerName,
          order.city,
          order.items.reduce((count, item) => count + item.qty, 0),
          (order.total / 100).toFixed(2),
          order.paymentStatus,
          order.orderStatus,
        ]),
      ]);
      toast("Orders exported");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="glass grid min-h-[280px] place-items-center rounded-3xl">
        <p className="flex items-center gap-2 text-[13px] text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading {demoMode ? "sample" : "live"} data…
        </p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <p className="text-[13px] text-coral">{error || "Dashboard is unavailable."}</p>
      </div>
    );
  }

  const liveOrders = stats.orderCount;
  const avg = liveOrders > 0 ? Math.round(stats.revenue / liveOrders) : 0;
  const chart = [...stats.recent].reverse().slice(-7);
  const peak = Math.max(...chart.map((order) => order.total), 1);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Overview</p>
          <h1 className="mt-1.5 text-[clamp(24px,3.2vw,32px)]">Good morning, studio.</h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {liveOrders} orders · {stats.products} active products · {stats.pendingOrders} pending payment ·{" "}
            {stats.openPrizes} prizes open
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void exportOrders()} className="btn-glass" disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export orders
          </button>
          <Link to="/admin/products" className="btn-primary">
            <PackagePlus className="h-4 w-4" /> New product
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: demoMode ? "Sample revenue" : "Verified revenue", value: inr(stats.revenue), hint: demoMode ? "Illustrative data only" : "Sum of verified Razorpay payments", icon: TrendingUp },
          { label: "Orders", value: String(liveOrders), hint: `${stats.pendingOrders} awaiting payment`, icon: ShoppingBag },
          { label: "Customers", value: String(stats.customers), hint: "Unique customer IDs", icon: Users },
          { label: demoMode ? "Sample average order" : "Average order", value: inr(avg), hint: demoMode ? "Illustrative data only" : "Incl. GST and shipping", icon: ArrowUpRight },
        ].map((kpi) => (
          <div key={kpi.label} className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/35">{kpi.label}</p>
              <kpi.icon className="h-4 w-4 text-violet-300" />
            </div>
            <p className="num mt-3 text-[26px] font-bold tracking-[-0.03em] text-white">{kpi.value}</p>
            <p className="mt-1 text-[11px] text-white/35">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px]">Order value, latest 7</h2>
            <span className="chip">{demoMode ? "Sample data" : "Live"}</span>
          </div>
          <div className="mt-5 flex h-[180px] items-end gap-2.5">
            {chart.length === 0 ? (
              <p className="text-[12px] text-white/40">No orders yet.</p>
            ) : (
              chart.map((order) => (
                <div key={order.id} className="group flex flex-1 flex-col items-center gap-2">
                  <span className="num text-[9.5px] text-white/40 opacity-0 transition group-hover:opacity-100">
                    {inr(order.total)}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-violet-600/40 to-violet-300 transition-all duration-500 group-hover:from-coral/40 group-hover:to-coral"
                    style={{ height: `${Math.max(12, (order.total / peak) * 130)}px` }}
                  />
                  <span className="text-[9px] text-white/30">{order.id.slice(-4)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-3xl p-5">
          <h2 className="text-[15px]">Needs attention</h2>
          <div className="mt-3 grid gap-2">
            {stats.lowStock.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-white/85">{product.name}</p>
                  <p className="text-[10.5px] text-white/35">{product.category}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    product.stock === 0 ? "bg-coral/15 text-coral" : "bg-sun/15 text-sun"
                  }`}
                >
                  {product.stock === 0 ? "Out" : `${product.stock} left`}
                </span>
              </div>
            ))}
            {stats.lowStock.length === 0 && (
              <p className="text-[12px] text-white/40">Everything is comfortably in stock.</p>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-2xl border border-violet-300/20 bg-violet-500/10 px-3 py-2.5">
            <span className="text-[12px] text-violet-100">Pending payments</span>
            <span className="num text-[14px] font-semibold text-violet-100">{stats.pendingOrders}</span>
          </div>
        </div>
      </div>

      <div className="glass mt-4 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[15px]">Recent orders</h2>
          <Link to="/admin/orders" className="text-[11.5px] font-medium text-violet-300 hover:text-white">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-y border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                <th className="px-5 py-2.5 font-semibold">Order</th>
                <th className="px-5 py-2.5 font-semibold">Customer</th>
                <th className="px-5 py-2.5 font-semibold">City</th>
                <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                <th className="px-5 py-2.5 font-semibold">Payment</th>
                <th className="px-5 py-2.5 font-semibold">Order</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[12px] text-white/40">
                    No orders yet. The storefront is live and accepting the catalogue.
                  </td>
                </tr>
              ) : (
                stats.recent.map((order) => (
                  <tr key={order.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                    <td className="px-5 py-3 font-mono text-[11.5px] text-white/75">{order.id}</td>
                    <td className="px-5 py-3 text-white/80">{order.customerName}</td>
                    <td className="px-5 py-3 text-white/50">{order.city}</td>
                    <td className="num px-5 py-3 text-right text-white/85">{inr(order.total)}</td>
                    <td className="px-5 py-3"><StatusPill status={order.paymentStatus} /></td>
                    <td className="px-5 py-3"><StatusPill status={order.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
