import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { inr, initials, shortDate } from "@/lib/format";
import { getCustomer, getCustomers, type AdminCustomer, type AdminOrder } from "@/lib/admin";
import { WhatsAppChat } from "./WhatsAppChat";

export function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [history, setHistory] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await getCustomers(query));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const showHistory = async (customer: AdminCustomer) => {
    setSelected(customer);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const result = await getCustomer(customer.customerCode);
      setSelected(result.customer);
      setHistory(result.orders);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load customer orders.");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">CRM</p>
        <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Customers</h1>
        <p className="mt-1 text-[12.5px] text-white/45">{customers.length} customer IDs</p>
      </div>

      <div className="glass mb-4 flex items-center gap-2 rounded-2xl p-2">
        <Search className="ml-2 h-4 w-4 text-white/30" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, ID, phone or email"
          className="w-full bg-transparent px-1 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      <div className="glass overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Customer ID</th>
                <th className="px-5 py-3 font-semibold">Contact</th>
                <th className="px-5 py-3 font-semibold">City</th>
                <th className="px-5 py-3 text-right font-semibold">Orders</th>
                <th className="px-5 py-3 text-right font-semibold">Spend</th>
                <th className="px-5 py-3 font-semibold">Since</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-white/45">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-white/40">No customers found.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.customerCode}
                    className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                    onClick={() => void showHistory(customer)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-violet-300/30 bg-violet-500/15 text-[10.5px] font-bold text-violet-200">
                          {initials(customer.name)}
                        </span>
                        <span className="font-medium text-white/85">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-violet-200/80">{customer.customerCode}</td>
                    <td className="px-5 py-3">
                      <p className="text-white/70">{customer.phone}</p>
                      <p className="text-[10.5px] text-white/30">{customer.email}</p>
                    </td>
                    <td className="px-5 py-3 text-white/60">{customer.city}</td>
                    <td className="num px-5 py-3 text-right text-white/70">{customer.orders}</td>
                    <td className="num px-5 py-3 text-right text-white/85">{inr(customer.spend)}</td>
                    <td className="px-5 py-3 text-[11.5px] text-white/40">{shortDate(customer.joinedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <section className="glass mt-4 rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px]">{selected.name} · {selected.customerCode}</h2>
              <p className="mt-1 text-[11.5px] text-white/45">
                {selected.email} · {selected.phone} · {selected.address}, {selected.city}, {selected.state} {selected.postalCode}
              </p>
            </div>
            <p className="text-[12px] text-white/55">{selected.orders} orders · {inr(selected.spend)} paid</p>
          </div>
          <WhatsAppChat name={selected.name} phone={selected.phone} />
          <h3 className="mt-5 text-[12px] font-semibold text-white/75">Order history</h3>
          {historyLoading ? (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-white/45">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
            </p>
          ) : history.length === 0 ? (
            <p className="mt-3 text-[12px] text-white/40">No orders for this customer.</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {history.map((order) => (
                <div key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 px-3 py-2 text-[11.5px]">
                  <span className="font-mono text-violet-200/80">{order.orderNumber}</span>
                  <span className="text-white/45">{shortDate(order.createdAt)}</span>
                  <span className="capitalize text-white/55">{order.paymentStatus} · {order.orderStatus}</span>
                  <span className="num text-white/80">{inr(order.total)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
