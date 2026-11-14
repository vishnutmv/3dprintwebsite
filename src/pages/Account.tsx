import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bell,
  BellRing,
  Check,
  Download,
  Gift,
  Heart,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  PackageOpen,
  Pencil,
  Phone,
  ReceiptText,
  Save,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { OrderTracker } from "@/components/OrderTracker";
import { ProductCard } from "@/components/ProductCard";
import { ReceiptModal } from "@/components/ReceiptModal";
import { StatusPill } from "@/components/ui";
import { ApiError, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAccount } from "@/lib/account";
import { useSocial } from "@/lib/social";
import { dismissAccountPrompt, rememberCustomerCode } from "@/lib/customer";
import { inr, shortDate } from "@/lib/format";
import { createInvoicePdf } from "@/lib/invoice";
import { useToast } from "@/lib/toast";
import { tamilNaduDistricts } from "@/lib/regions";
import type { CustomerProfile, CustomerTransactions, Order } from "@/lib/types";

type CustomerResponse = {
  customer: CustomerProfile;
  orders: Order[];
};

const TABS = [
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
  { id: "history", label: "History", icon: Gift },
  { id: "favourites", label: "Favourites", icon: Heart },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTab(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

export function Account() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pushToast = useToast((state) => state.push);
  const setAccountCustomer = useAccount((state) => state.setCustomer);
  const social = useSocial();

  const requestedTab = params.get("tab");
  const activeTab: TabId = isTab(requestedTab) ? requestedTab : "orders";
  const next = params.get("next") ?? "";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signup, setSignup] = useState({ name: "", email: "", phone: "" });
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransactions | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<CustomerResponse>("/api/customer/session");
      rememberCustomerCode(response.customer.code);
      dismissAccountPrompt();
      setData(response);
      setAccountCustomer(response.customer);
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 401)) {
        setError(caught instanceof Error ? caught.message : "Could not load your profile.");
      } else {
        setAccountCustomer(null);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [setAccountCustomer]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!data) return;
    if (social.loadedFor !== data.customer.code) void social.fetchSocial(data.customer.code);
  }, [data, social]);

  useEffect(() => {
    if (activeTab !== "history" || transactions || transactionsLoading) return;
    setTransactionsLoading(true);
    setHistoryError("");
    apiGet<CustomerTransactions>("/api/customer/transactions")
      .then(setTransactions)
      .catch((caught) => setHistoryError(caught instanceof Error ? caught.message : "Could not load your transaction history."))
      .finally(() => setTransactionsLoading(false));
  }, [activeTab, transactions, transactionsLoading]);

  const switchTab = (tab: TabId) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", tab);
    nextParams.delete("next");
    setParams(nextParams, { replace: true });
  };

  const sendCode = async (targetPhone = phone) => {
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await apiPost<{ message: string }>("/api/customer/auth/request", { phone: targetPhone });
      setCodeRequested(true);
      setMessage(response.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not request a sign-in code.");
    } finally {
      setSending(false);
    }
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    setMessage("");
    try {
      await apiPost<{ customer: CustomerProfile; message: string }>("/api/customer/register", signup);
      setPhone(signup.phone);
      setMessage("Account created. Sending your WhatsApp sign-in code…");
      await sendCode(signup.phone);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your account.");
    } finally {
      setSending(false);
    }
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
      setAccountCustomer(response.customer);
      setCodeRequested(false);
      setCode("");
      setMessage("");
      pushToast(`Welcome, ${response.customer.name}`, "success");
      if (next.startsWith("/")) navigate(next, { replace: true });
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
      setAccountCustomer(null);
      social.reset();
      setCodeRequested(false);
      setCode("");
      setMessage("");
      setTransactions(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
    } finally {
      setSending(false);
    }
  };

  const orders = data?.orders ?? [];
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const unreadNotifications = social.unreadCount;

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
              ? `Customer ID ${data.customer.code} · ${orders.length} ${orders.length === 1 ? "order" : "orders"} · ${paidOrders.length} paid`
              : "Sign in with a one-time WhatsApp code, or create an account."}
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
          onSubmit={mode === "signup" && !codeRequested ? register : codeRequested ? verifyCode : (event) => { event.preventDefault(); void sendCode(); }}
        >
          <div className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => { setMode("signin"); setCodeRequested(false); setError(""); setMessage(""); }}
              className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${mode === "signin" ? "bg-violet-400 text-ink-950" : "text-white/55"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setCodeRequested(false); setError(""); setMessage(""); }}
              className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${mode === "signup" ? "bg-violet-400 text-ink-950" : "text-white/55"}`}
            >
              Create account
            </button>
          </div>

          <h2 className="mt-5 text-[17px] font-semibold">
            {codeRequested ? "Enter your sign-in code" : mode === "signup" ? "Create your account" : "Sign in with WhatsApp"}
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            {codeRequested
              ? "A six-character code (letters and numbers) was sent to your WhatsApp or the email on your account."
              : mode === "signup"
                ? "Accounts are needed to buy, review products and save favourites."
                : "Use the mobile number on your account. A code is sent to WhatsApp or email."}
          </p>

          {mode === "signup" && !codeRequested && (
            <>
              <label className="label mt-4" htmlFor="signup-name">Full name</label>
              <input
                id="signup-name"
                className="field"
                value={signup.name}
                onChange={(event) => setSignup((current) => ({ ...current, name: event.target.value }))}
                placeholder="Aarav Menon"
                autoComplete="name"
                required
              />
              <label className="label mt-3" htmlFor="signup-email">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  id="signup-email"
                  className="field pl-10"
                  type="email"
                  value={signup.email}
                  onChange={(event) => setSignup((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.in"
                  autoComplete="email"
                  required
                />
              </div>
              <label className="label mt-3" htmlFor="signup-phone">Mobile number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  id="signup-phone"
                  className="field pl-10"
                  type="tel"
                  value={signup.phone}
                  onChange={(event) => setSignup((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+91 98400 11288"
                  autoComplete="tel"
                  required
                />
              </div>
            </>
          )}

          {mode === "signin" && !codeRequested && (
            <>
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
            </>
          )}

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
            {codeRequested ? "Verify and open profile" : mode === "signup" ? "Create account & send code" : "Send WhatsApp code"}
          </button>
          {codeRequested && (
            <button type="button" className="mt-3 w-full text-[11px] text-white/50 underline underline-offset-2" onClick={() => void sendCode()} disabled={sending}>
              Send another code
            </button>
          )}
          <p className="mt-4 text-[10.5px] text-white/35">
            Codes expire in five minutes and can be used once. You must be signed in to buy, review and save favourites.
          </p>
        </form>
      ) : (
        <>
          <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((tab) => {
              const label = tab.id === "notifications" && unreadNotifications > 0
                ? `${tab.label} (${unreadNotifications})`
                : tab.label;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition ${
                    activeTab === tab.id
                      ? "border-transparent bg-violet-400 text-ink-950"
                      : "border-white/12 bg-white/[0.04] text-white/55 hover:text-white"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === "orders" && (
            <OrdersTab
              orders={orders}
              customerCode={data.customer.code}
              expandedOrder={expandedOrder}
              onToggle={(number) => setExpandedOrder((current) => (current === number ? null : number))}
              onViewReceipt={setReceiptOrder}
              paidCount={paidOrders.length}
            />
          )}

          {activeTab === "profile" && (
            <ProfileTab
              customer={data.customer}
              onSaved={(response) => {
                setData(response);
                setAccountCustomer(response.customer);
                setTransactions(null);
                pushToast("Profile updated", "success");
              }}
              onError={(text) => pushToast(text, "error")}
            />
          )}

          {activeTab === "invoices" && <InvoicesTab orders={paidOrders} onViewReceipt={setReceiptOrder} />}

          {activeTab === "history" && (
            <HistoryTab
              data={transactions}
              loading={transactionsLoading}
              error={historyError}
            />
          )}

          {activeTab === "favourites" && (
            <FavouritesTab customerCode={data.customer.code} />
          )}

          {activeTab === "notifications" && <NotificationsTab />}
        </>
      )}

      {receiptOrder && <ReceiptModal order={receiptOrder} onClose={() => setReceiptOrder(null)} />}
    </div>
  );
}

/* ------------------------------- Orders -------------------------------- */

function OrdersTab({
  orders,
  customerCode,
  expandedOrder,
  onToggle,
  onViewReceipt,
  paidCount,
}: {
  orders: Order[];
  customerCode: string;
  expandedOrder: string | null;
  onToggle: (orderNumber: string) => void;
  onViewReceipt: (order: Order) => void;
  paidCount: number;
}) {
  if (orders.length === 0) {
    return (
      <div className="glass liquid-edge mt-4 rounded-[2rem] p-10 text-center">
        <PackageOpen className="mx-auto h-9 w-9 text-violet-300" />
        <h2 className="mt-3 text-[22px]">No orders yet</h2>
        <p className="mt-2 text-[12.5px] text-white/50">Your order history and live courier timeline will appear here.</p>
        <Link to="/shop" className="btn-primary mt-5 inline-flex">Browse prints</Link>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-3">
      <div className="glass rounded-2xl px-4 py-3 text-[12px] text-white/50">
        <div className="flex items-center gap-2 font-semibold text-white/75">
          <Gift className="h-4 w-4 text-sun" /> Prize programme
        </div>
        <p className="mt-1">
          {paidCount} paid {paidCount === 1 ? "order" : "orders"} on this account. Reward eligibility depends on the offer terms.
        </p>
      </div>

      {orders.map((order) => {
        const open = expandedOrder === order.orderNumber;
        return (
          <div key={order.id} className="glass overflow-hidden rounded-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <button type="button" onClick={() => onToggle(order.orderNumber)} className="min-w-0 text-left">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-violet-200">{order.orderNumber}</span>
                  <StatusPill status={order.paymentStatus} />
                  <StatusPill status={order.orderStatus} />
                </span>
                <span className="mt-1 block text-[11.5px] text-white/45">
                  {shortDate(order.createdAt)} · {order.items.reduce((count, item) => count + item.qty, 0)} units · {inr(order.total)}
                </span>
                <span className="mt-1 block truncate text-[11.5px] text-white/35">
                  {order.items.map((item) => item.name).join(", ")}
                </span>
              </button>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-glass !px-3 !py-1.5 text-[11px]"
                  onClick={() => onViewReceipt(order)}
                >
                  <ReceiptText className="h-3.5 w-3.5" /> View receipt
                </button>
                {order.paymentStatus === "paid" && (
                  <button
                    type="button"
                    className="btn-glass !px-3 !py-1.5 text-[11px]"
                    onClick={() => createInvoicePdf(order).save(`invoice-${order.orderNumber}.pdf`)}
                  >
                    <Download className="h-3.5 w-3.5" /> Invoice
                  </button>
                )}
                <button type="button" className="btn-glass !px-3 !py-1.5 text-[11px]" onClick={() => onToggle(order.orderNumber)}>
                  {open ? "Hide tracking" : "Track order"}
                </button>
              </div>
            </div>
            {open && (
              <div className="border-t border-white/8 bg-white/[0.02] p-4">
                <OrderTracker order={order} />
                <Link
                  to={`/order/${order.orderNumber}?code=${encodeURIComponent(customerCode)}`}
                  className="mt-3 inline-flex text-[11px] text-violet-200 underline underline-offset-2"
                >
                  Open full order page
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------- Profile ------------------------------- */

function ProfileTab({
  customer,
  onSaved,
  onError,
}: {
  customer: CustomerProfile;
  onSaved: (response: CustomerResponse) => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: customer.name,
    email: customer.email ?? "",
    phone: customer.phone,
    address: customer.address ?? "",
    city: customer.city || "Chennai",
    postalCode: customer.postalCode ?? "",
    marketingOptIn: customer.marketingOptIn,
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({
      ...current,
      [key]: event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value,
    }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await apiPatch<CustomerResponse>("/api/customer/profile", form);
      onSaved(response);
      setEditing(false);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass mt-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[16px]"><UserRound className="h-4 w-4 text-violet-300" /> Your details</h2>
          <p className="mt-1 text-[11.5px] text-white/45">Used for deliveries, invoices and account notifications.</p>
        </div>
        <button type="button" className="btn-glass !px-3 !py-1.5 text-[11px]" onClick={() => setEditing((current) => !current)}>
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editing ? "Editing" : "Edit details"}
        </button>
      </div>

      {!editing ? (
        <div className="mt-4 grid gap-3 text-[12.5px] sm:grid-cols-2">
          <Detail label="Full name" value={customer.name} />
          <Detail label="Customer ID" value={customer.code} mono />
          <Detail label="Phone" value={customer.phone} />
          <Detail label="Email" value={customer.email || "Not set"} />
          <Detail label="Address" value={customer.address || "Not set"} />
          <Detail label="City / PIN" value={[customer.city, customer.postalCode].filter(Boolean).join(" · ") || "Not set"} />
          <Detail label="Marketing updates" value={customer.marketingOptIn ? "Opted in" : "Not subscribed"} />
        </div>
      ) : (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={save}>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profile-name">Full name</label>
            <input id="profile-name" className="field" value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <label className="label" htmlFor="profile-phone">Mobile number</label>
            <input id="profile-phone" className="field" value={form.phone} onChange={set("phone")} inputMode="tel" required />
          </div>
          <div>
            <label className="label" htmlFor="profile-email">Email</label>
            <input id="profile-email" className="field" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profile-address">Delivery address</label>
            <input id="profile-address" className="field" value={form.address} onChange={set("address")} placeholder="Flat / street / landmark" />
          </div>
          <div>
            <label className="label" htmlFor="profile-city">District</label>
            <select id="profile-city" className="field" value={form.city} onChange={set("city")}>
              {tamilNaduDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="profile-pin">PIN code</label>
            <input id="profile-pin" className="field" value={form.postalCode} onChange={set("postalCode")} inputMode="numeric" maxLength={6} />
          </div>
          <label className="sm:col-span-2 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
            <input type="checkbox" checked={form.marketingOptIn} onChange={set("marketingOptIn")} className="mt-0.5 h-4 w-4 accent-violet-500" />
            <span>Send me product news and offers. Optional — campaigns only go to opted-in customers.</span>
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </button>
            <button type="button" className="btn-glass" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className={`mt-0.5 text-[12.5px] text-white/80 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

/* -------------------------------- Invoices ------------------------------ */

function InvoicesTab({ orders, onViewReceipt }: { orders: Order[]; onViewReceipt: (order: Order) => void }) {
  if (orders.length === 0) {
    return (
      <div className="glass mt-4 rounded-2xl p-8 text-center">
        <ReceiptText className="mx-auto h-8 w-8 text-violet-300" />
        <h2 className="mt-3 text-[18px]">No invoices yet</h2>
        <p className="mt-1 text-[12px] text-white/45">Invoices become available after a payment is verified.</p>
      </div>
    );
  }
  return (
    <div className="glass mt-4 overflow-hidden rounded-2xl">
      <div className="border-b border-white/8 px-4 py-3">
        <h2 className="text-[15px]">Payment invoices</h2>
        <p className="mt-0.5 text-[11.5px] text-white/45">Download a PDF for any paid order.</p>
      </div>
      <div className="divide-y divide-white/5">
        {orders.map((order) => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-mono text-[11.5px] text-violet-200">{order.orderNumber}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{shortDate(order.createdAt)} · {inr(order.total)} · {order.items.length} line items</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={order.paymentStatus} />
              <button
                type="button"
                className="btn-glass !px-3 !py-1.5 text-[11px]"
                onClick={() => onViewReceipt(order)}
              >
                <ReceiptText className="h-3.5 w-3.5" /> View receipt
              </button>
              <button
                type="button"
                className="btn-glass !px-3 !py-1.5 text-[11px]"
                onClick={() => createInvoicePdf(order).save(`invoice-${order.orderNumber}.pdf`)}
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- History ------------------------------- */

function HistoryTab({ data, loading, error }: { data: CustomerTransactions | null; loading: boolean; error: string }) {
  if (loading) {
    return (
      <div className="glass mt-4 rounded-2xl p-8 text-center text-[12px] text-white/50">
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading transactions…
      </div>
    );
  }
  if (error) {
    return <p className="mt-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">{error}</p>;
  }
  if (!data) return null;

  return (
    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total paid", value: inr(data.summary.totalSpend) },
          { label: "Paid orders", value: String(data.summary.paidOrders) },
          { label: "Pending", value: String(data.summary.pendingOrders) },
          { label: "Refunded", value: String(data.summary.refundedOrders) },
        ].map((item) => (
          <div key={item.label} className="glass rounded-2xl p-4">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/35">{item.label}</p>
            <p className="num mt-1 text-[20px] font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/8 px-4 py-3">
          <h2 className="text-[15px]">Recent transactions</h2>
          <p className="mt-0.5 text-[11.5px] text-white/45">Order payments recorded on your account.</p>
        </div>
        {data.transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-white/45">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {data.transactions.map((transaction) => (
              <div key={`${transaction.id}-${transaction.createdAt}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-[11.5px] text-violet-200">{transaction.orderNumber}</p>
                  <p className="mt-0.5 text-[11px] text-white/45">
                    {transaction.createdAt ? shortDate(transaction.createdAt) : "—"}
                    {transaction.paymentId ? ` · ${transaction.paymentId}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={transaction.paymentStatus} />
                  <span className="num min-w-[84px] text-right text-[12.5px] font-semibold text-white/85">{inr(transaction.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Favourites ----------------------------- */

function FavouritesTab({ customerCode }: { customerCode: string }) {
  const loadedFor = useSocial((state) => state.loadedFor);
  const loading = useSocial((state) => state.loading);
  const products = useSocial((state) => state.favoriteProducts);
  const fetchSocial = useSocial((state) => state.fetchSocial);

  useEffect(() => {
    if (loadedFor !== customerCode) void fetchSocial(customerCode);
  }, [customerCode, fetchSocial, loadedFor]);

  if (loading && products.length === 0) {
    return (
      <div className="glass mt-4 rounded-2xl p-8 text-center text-[12px] text-white/50">
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading favourites…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="glass mt-4 rounded-2xl p-8 text-center">
        <Heart className="mx-auto h-8 w-8 text-coral" />
        <h2 className="mt-3 text-[18px]">No favourites yet</h2>
        <p className="mt-1 text-[12px] text-white/45">Tap the heart on any product to keep it here.</p>
        <Link to="/shop" className="btn-primary mt-4 inline-flex">Find something you love</Link>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}

/* ------------------------------ Notifications --------------------------- */

function NotificationsTab() {
  const notifications = useSocial((state) => state.notifications);
  const unreadCount = useSocial((state) => state.unreadCount);
  const markAllRead = useSocial((state) => state.markAllRead);
  const refresh = useSocial((state) => state.refreshNotifications);
  const pushToast = useToast((state) => state.push);

  const markRead = async () => {
    try {
      await markAllRead();
      pushToast("Notifications marked as read", "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update notifications", "error");
    }
  };

  return (
    <div className="glass mt-4 overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px]"><BellRing className="h-4 w-4 text-violet-300" /> Notifications</h2>
          <p className="mt-0.5 text-[11.5px] text-white/45">
            {unreadCount > 0 ? `${unreadCount} unread` : "You are all caught up"} · purchases, status changes and replies.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-glass !px-3 !py-1.5 text-[11px]" onClick={() => void refresh()}>
            Refresh
          </button>
          {unreadCount > 0 && (
            <button type="button" className="btn-primary !px-3 !py-1.5 text-[11px]" onClick={() => void markRead()}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-2 text-[12px] text-white/45">Order updates, review replies and studio notices will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {notifications.map((notification) => {
            const content = (
              <div className={`px-4 py-3 transition hover:bg-white/[0.03] ${notification.readAt ? "" : "bg-violet-400/[0.05]"}`}>
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${notification.readAt ? "bg-white/20" : "bg-violet-400"}`} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-white/85">{notification.title}</p>
                    {notification.body && <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-relaxed text-white/50">{notification.body}</p>}
                    <p className="mt-1 text-[10px] text-white/30">
                      {notification.kind.replace(/_/g, " ")} · {notification.createdAt ? shortDate(notification.createdAt) : ""}
                    </p>
                  </div>
                </div>
              </div>
            );
            return notification.link
              ? <Link key={notification.id} to={notification.link} className="block">{content}</Link>
              : <div key={notification.id}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
