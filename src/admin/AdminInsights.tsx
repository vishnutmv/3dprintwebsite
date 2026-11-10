import { useCallback, useEffect, useState } from "react";
import { Loader2, TrendingUp, Users, Wallet } from "lucide-react";
import { inr } from "@/lib/format";
import { getInsights, type AdminInsights as InsightsData } from "@/lib/admin";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getInsights());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load sales insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="py-16 text-center text-sm text-white/45"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading insights…</div>;
  if (error || !data) return <p className="rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-sm text-coral">{error || "No insight data is available."}</p>;

  const countsByDay = new Map(data.dailyPaidOrders.map((day) => [day.day, day.count]));
  const dailySeries = Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const day = date.toISOString().slice(0, 10);
    return { day, count: countsByDay.get(day) ?? 0 };
  });
  const maxDaily = Math.max(1, ...dailySeries.map((day) => day.count));
  const maxHeat = Math.max(1, ...data.enquiryHeatmap.map((cell) => cell.count));
  const heat = new Map(data.enquiryHeatmap.map((cell) => [`${cell.weekday}:${cell.hour}`, cell.count]));

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Analytics</p>
        <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Business insights</h1>
        <p className="mt-1 text-[12.5px] text-white/45">Paid orders, tracked WhatsApp enquiries, and product demand.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Business enquiries" value={data.summary.enquiries.toLocaleString()} icon={<Users className="h-4 w-4" />} />
        <Metric label="Converted to buyers" value={`${data.summary.conversions.toLocaleString()} · ${data.summary.conversionRate}%`} icon={<TrendingUp className="h-4 w-4" />} />
        <Metric label="Paid orders" value={data.summary.paidOrders.toLocaleString()} icon={<TrendingUp className="h-4 w-4" />} />
        <Metric label="Paid revenue" value={inr(data.summary.revenue)} icon={<Wallet className="h-4 w-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-white/85">Paid orders · 30 days</h2>
          {dailySeries.every((day) => day.count === 0) ? (
            <p className="py-12 text-center text-xs text-white/40">No paid orders in this period.</p>
          ) : (
            <div className="mt-5 flex h-40 items-end gap-1">
              {dailySeries.map((day) => (
                <div key={day.day} className="group relative flex h-full flex-1 items-end" title={`${day.day}: ${day.count} paid orders`}>
                  <div className="w-full rounded-t-sm bg-violet-400/75 transition-colors group-hover:bg-violet-300" style={{ height: `${Math.max(3, day.count / maxDaily * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[10px] text-white/35">Each bar is one date. Hover a bar to see its date and order count.</p>
        </section>

        <section className="glass rounded-3xl p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-white/85">Enquiry activity heatmap · 90 days</h2>
            <span className="text-[10px] text-white/35">UTC (server timestamps)</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[670px]">
              <div className="mb-1 grid grid-cols-[36px_repeat(24,minmax(14px,1fr))] gap-1">
                <span />
                {Array.from({ length: 24 }, (_, hour) => <span key={hour} className="text-center text-[8px] text-white/30">{hour % 3 === 0 ? `${hour}` : ""}</span>)}
              </div>
              {weekdays.map((day, weekday) => (
                <div key={day} className="mb-1 grid grid-cols-[36px_repeat(24,minmax(14px,1fr))] items-center gap-1">
                  <span className="text-[9px] text-white/45">{day}</span>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = heat.get(`${weekday}:${hour}`) ?? 0;
                    return <span key={hour} title={`${day} ${hour}:00 · ${count} enquiries`} className="aspect-square rounded-[3px] bg-violet-400" style={{ opacity: count ? 0.15 + count / maxHeat * 0.8 : 0.04 }} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="glass mt-4 overflow-hidden rounded-3xl">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-sm font-semibold text-white/85">Product trends</h2>
          <p className="mt-1 text-[10.5px] text-white/35">Only verified paid orders count. “Hot” means 3+ units sold in the last 30 days; “Best seller” means 10+ units overall.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12px]">
            <thead><tr className="text-[9px] uppercase tracking-wider text-white/35"><th className="px-5 py-3">Product</th><th className="px-5 py-3 text-right">Units sold</th><th className="px-5 py-3 text-right">Last 30 days</th><th className="px-5 py-3 text-right">Paid revenue</th><th className="px-5 py-3">Auto tag</th></tr></thead>
            <tbody>
              {data.products.map((product) => (
                <tr key={product.id} className="border-t border-white/5">
                  <td className="px-5 py-3 text-white/80">{product.name}</td>
                  <td className="px-5 py-3 text-right text-white/60">{product.units}</td>
                  <td className="px-5 py-3 text-right text-white/60">{product.recentUnits}</td>
                  <td className="px-5 py-3 text-right text-white/70">{inr(product.revenue)}</td>
                  <td className="px-5 py-3">{product.trendTag ? <span className="chip">{product.trendTag}</span> : <span className="text-white/25">—</span>}</td>
                </tr>
              ))}
              {data.products.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-white/40">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="glass rounded-2xl p-4"><div className="flex items-center justify-between text-white/45"><span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>{icon}</div><p className="num mt-3 text-xl font-bold text-white">{value}</p></div>;
}
