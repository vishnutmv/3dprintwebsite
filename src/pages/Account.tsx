import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, KeyRound, Loader2, LogOut, PackageOpen, Phone } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { dismissAccountPrompt, rememberCustomerCode } from "@/lib/customer";
import { inr, shortDate } from "@/lib/format";
import type { Order } from "@/lib/types";

type CustomerResponse = {
  customer: { code: string; name: string; email: string | null; phone: string };
  orders: Order[];
};

export function Account() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<CustomerResponse>("/api/customer/session");
      rememberCustomerCode(response.customer.code);
      dismissAccountPrompt();
      setData(response);
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 401)) {
        setError(caught instanceof Error ? caught.message : "Could not load your profile.");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const sendCode = async () => {
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await apiPost<{ message: string }>("/api/customer/auth/request", { phone });
      setCodeRequested(true);
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a sign-in code.");
    } finally {
      setSending(false);
    }
  };

  const requestCode = (event: React.FormEvent) => {
    event.preventDefault();
    void sendCode();
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[A-Z0-9]{6}$/.test(code.trim())) {
      setError("Enter the six-character code sent to your WhatsApp.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await apiPost<CustomerResponse>("/api/customer/auth/verify", {
        phone,
        code: code.trim(),
      });
      rememberCustomerCode(response.customer.code);
      dismissAccountPrompt();
      setData(response);
      setCodeRequested(false);
      setCode("");
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code could not be verified.");
    } finally {
      setSending(false);
    }
  };

  const signOut = async () => {
    setSending(true);
    setError("");
    try {
      await apiPost<{ ok: boolean }>("/api/customer/logout", {});
      setData(null);
      setCodeRequested(false);
      setCode("");
      setMessage("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
    } finally {
      setSending(false);
    }
  };

  const orders = data?.orders ?? [];
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">Customer profile</p>
          <h1 className="mt-1 text-[clamp(24px,3.4vw,32px)]">
            {data ? `Welcome, ${data.customer.name}` : "Your orders, in one place"}
          </h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {data
              ? `Customer ID ${data.customer.code} · ${orders.length} ${orders.length === 1 ? "order" : "orders"}`
              : "Sign in securely with a one-time WhatsApp code."}
          </p>
        </div>
        {data && (
          <button type="button" className="btn-glass" onClick={() => void signOut()} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sign out
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      {loading ? (
        <div className="glass mt-6 rounded-[2rem] p-10 text-center text-[12.5px] text-white/50">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading your profile…
        </div>
      ) : !data ? (
        <form
          className="glass liquid-edge mt-6 max-w-xl rounded-[2rem] p-5 md:p-7"
          onSubmit={codeRequested ? verifyCode : requestCode}
        >
          <h2 className="text-[17px] font-semibold">
            {codeRequested ? "Enter your sign-in code" : "Sign in with WhatsApp"}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            {codeRequested
              ? "If your number is linked to an order, a six-character code (letters and numbers) is sent to your WhatsApp or the email on that order."
              : "Use the mobile number you entered when placing an order."}
          </p>
          <label className="label mt-5" htmlFor="account-phone">Mobile number</label>
          <div className="relative mt-1">
            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              id="account-phone"
              className="field pl-10"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setCodeRequested(false);
                setMessage("");
              }}
              placeholder="+91 98400 11288"
              required
            />
          </div>
          {codeRequested && (
            <>
              <label className="label mt-4" htmlFor="account-code">Six-character code</label>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  id="account-code"
                  className="field pl-10 font-mono tracking-[0.25em]"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  inputMode="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="K7M2X9"
                  required
                />
              </div>
            </>
          )}
          {message && <p className="mt-3 text-[11.5px] text-mint/85">{message}</p>}
          <button type="submit" className="btn-primary mt-5 w-full" disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : codeRequested ? <KeyRound className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
            {codeRequested ? "Verify and open profile" : "Send WhatsApp code"}
          </button>
          {codeRequested && (
            <button type="button" className="mt-3 w-full text-[11px] text-white/50 underline underline-offset-2" onClick={() => void sendCode()}>
              Send another code
            </button>
          )}
          <p className="mt-4 text-[10.5px] text-white/35">
            Profiles are available after an order has been placed. Codes expire in five minutes and can be used once.
          </p>
        </form>
      ) : orders.length === 0 ? (
        <div className="glass liquid-edge mt-6 rounded-[2rem] p-10 text-center">
          <PackageOpen className="mx-auto h-9 w-9 text-violet-300" />
          <h2 className="mt-3 text-[22px]">No orders yet</h2>
          <p className="mt-2 text-[12.5px] text-white/50">Your order history will appear here after checkout.</p>
          <Link to="/shop" className="btn-primary mt-5 inline-flex">Browse prints</Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4">
            <div className="glass overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-white/8 text-[9.5px] uppercase tracking-[0.14em] text-white/35">
                      <th className="px-4 py-3 font-semibold">Order</th>
                      <th className="px-4 py-3 font-semibold">Date (IST)</th>
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
                          <Link to={`/order/${order.orderNumber}?code=${encodeURIComponent(data.customer.code)}`} className="font-mono text-[11px] text-violet-200 hover:text-white">
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-white/60">{shortDate(order.createdAt)}</td>
                        <td className="px-4 py-3 text-white/60">{order.items.reduce((count, item) => count + item.qty, 0)} units</td>
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
                {paidOrders.length} paid {paidOrders.length === 1 ? "order" : "orders"} on this account. Reward eligibility depends on the offer terms.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
