/**
 * Account page — looks up the customer's order history through the PHP API
 * using their customer code. No order or customer data is read from localStorage.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Loader2, PackageOpen, Search } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { rememberedCustomerCode, rememberCustomerCode } from "@/lib/customer";
import type { Order } from "@/lib/types";

type CustomerResponse = {
  customer: { code: string; name: string; email: string | null; phone: string };
  orders: Order[];
};

export function Account() {
  const [code, setCode] = useState(() => rememberedCustomerCode());
  const [input, setInput] = useState("");
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (customerCode: string) => {
    const normalized = customerCode.trim().toUpperCase();
    if (!/^3DP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
      setError("Enter your customer ID, e.g. 3DP-K4M2-9XQP.");
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<CustomerResponse>(
        `/api/customers/${encodeURIComponent(normalized)}/orders`,
      );
      setData(response);
      setCode(normalized);
      rememberCustomerCode(normalized);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your orders.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (code) void load(code);
    // Only the initial remembered code is auto-loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orders = data?.orders ?? [];
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const customerCode = data?.customer.code ?? code;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-24">
      <h1 className="text-[clamp(24px,3.4vw,32px)]">My account</h1>
      <p className="mt-1 text-[12.5px] text-white/45">
        {customerCode ? (
          <>
            Customer ID <span className="font-mono text-violet-300">{customerCode}</span> ·{" "}
            {orders.length} {orders.length === 1 ? "order" : "orders"}
            {paidOrders.length > 0 ? ` · ${paidOrders.length} paid` : ""}
          </>
        ) : (
          "Look up your orders with the customer ID issued at checkout."
        )}
      </p>

      <form
        className="glass mt-5 flex flex-wrap items-center gap-2 rounded-2xl p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(input || code);
        }}
      >
        <Search className="ml-2 h-4 w-4 text-white/30" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value.toUpperCase())}
          placeholder="3DP-XXXX-XXXX"
          className="min-w-[180px] flex-1 bg-transparent px-1 py-2 font-mono text-[13px] text-white placeholder:text-white/25 focus:outline-none"
          aria-label="Customer ID"
        />
        <button type="submit" className="btn-glass !py-2 !text-[11.5px]" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find my orders"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      {loading ? (
        <div className="glass mt-6 rounded-[2rem] p-10 text-center text-[12.5px] text-white/50">
          Loading your order history…
        </div>
      ) : orders.length === 0 ? (
        <div className="glass liquid-edge mt-6 rounded-[2rem] p-10 text-center">
          <PackageOpen className="mx-auto h-9 w-9 text-violet-300" />
          <h2 className="mt-3 text-[22px]">Nothing shipped yet</h2>
          <p className="mt-2 text-[12.5px] text-white/50">
            Place an order and it will appear here with its payment status.
          </p>
          <Link to="/shop" className="btn-primary mt-5 inline-flex">Browse prints</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div className="glass overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Items</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          to={`/order/${order.orderNumber}?code=${encodeURIComponent(customerCode)}`}
                          className="font-mono text-[11px] text-violet-200 hover:text-white"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-white/60">{shortDate(order.createdAt)}</td>
                      <td className="px-4 py-3 text-white/60">
                        {order.items.reduce((count, item) => count + item.qty, 0)} units
                      </td>
                      <td className="num px-4 py-3 text-right text-white/85">{inr(order.total)}</td>
                      <td className="px-4 py-3"><StatusPill status={order.paymentStatus} /></td>
                      <td className="px-4 py-3"><StatusPill status={order.orderStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-sun" />
              <h2 className="text-[15px]">Prize programme</h2>
            </div>
            <p className="mt-2 text-[12.5px] text-white/50">
              {paidOrders.length} paid {paidOrders.length === 1 ? "order" : "orders"} on this account. Reward
              eligibility depends on the offer terms. The studio assigns rewards manually; notifications are
              sent only when a delivery provider has been configured.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
