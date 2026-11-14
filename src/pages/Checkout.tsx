/**
 * Checkout — collects delivery details, asks the server to price and save the
 * order, then opens Razorpay TEST checkout. The browser never chooses the amount.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, ShieldCheck, UserRound } from "lucide-react";
import { inr } from "@/lib/format";
import { ApiError, apiPost } from "@/lib/api";
import { createPaymentSession, openRazorpayCheckout, verifyRazorpayPayment } from "@/lib/razorpay";
import { rememberCustomerCode, rememberOrderCode } from "@/lib/customer";
import { useAccount } from "@/lib/account";
import { demoMode } from "@/lib/demo-mode";
import { tamilNaduDistricts } from "@/lib/regions";
import { usePromotionClock } from "@/lib/promotions";
import { cartLines, useStore } from "@/lib/store";
import type { CheckoutContact, Order } from "@/lib/types";

const emptyContact: CheckoutContact = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "Chennai",
  state: "Tamil Nadu",
  postalCode: "",
  marketingOptIn: false,
};

export function Checkout() {
  const navigate = useNavigate();
  const cart = useStore((state) => state.cart);
  const products = useStore((state) => state.products);
  const settings = useStore((state) => state.settings);
  const clearCart = useStore((state) => state.clearCart);
  const fetchProducts = useStore((state) => state.fetchProducts);
  const fetchSettings = useStore((state) => state.fetchSettings);
  const now = usePromotionClock();
  const customer = useAccount((state) => state.customer);
  const accountLoaded = useAccount((state) => state.loaded);
  const refreshAccount = useAccount((state) => state.refresh);
  const prefilled = useRef(false);

  const [contact, setContact] = useState<CheckoutContact>(emptyContact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountLoaded) void refreshAccount();
  }, [accountLoaded, refreshAccount]);

  useEffect(() => {
    if (!customer || prefilled.current) return;
    prefilled.current = true;
    setContact({
      name: customer.name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      city: customer.city && tamilNaduDistricts.includes(customer.city as (typeof tamilNaduDistricts)[number])
        ? customer.city
        : "Chennai",
      state: "Tamil Nadu",
      postalCode: customer.postalCode ?? "",
      marketingOptIn: customer.marketingOptIn ?? false,
    });
  }, [customer]);

  const lines = cartLines({ cart, products }, now);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = subtotal === 0 || subtotal >= settings.freeShippingOver ? 0 : settings.shippingFlat;
  const total = subtotal + shipping;

  if (!accountLoaded) {
    return (
      <div className="mx-auto grid max-w-xl place-items-center px-4 py-28 text-center text-[12.5px] text-white/50">
        <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Checking your account…
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <UserRound className="mx-auto h-9 w-9 text-violet-300" />
        <h1 className="mt-3 text-[26px]">Sign in to check out</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Orders, invoices, tracking and review notifications are tied to your customer account. Sign in or create an account to continue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to={`/account?next=${encodeURIComponent("/checkout")}`} className="btn-primary">
            Sign in or create account
          </Link>
          <Link to="/shop" className="btn-glass">Back to shop</Link>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <h1 className="text-[26px]">Nothing to check out</h1>
        <p className="mt-2 text-sm text-white/50">Add a print to your cart first.</p>
        <Link to="/shop" className="btn-primary mt-6 inline-flex">
          Browse the catalogue
        </Link>
      </div>
    );
  }

  const setField = (key: keyof CheckoutContact) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setContact((previous) => ({ ...previous, [key]: event.target.value }));

  const validate = (): string | null => {
    if (contact.name.trim().length < 2) return "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim())) {
      return "Please enter a valid email address.";
    }
    if (contact.phone.replace(/\D/g, "").length < 10) {
      return "Phone number should have at least 10 digits.";
    }
    if (!/^(?:\+?91)?[6-9]\d{9}$/.test(contact.phone.replace(/\D/g, ""))) {
      return "Enter a valid Indian mobile number.";
    }
    if (!/^[6]\d{5}$/.test(contact.postalCode.trim())) {
      return "Enter a valid 6-digit Tamil Nadu PIN code.";
    }
    if (
      contact.address.trim().length < 5 ||
      !tamilNaduDistricts.includes(contact.city as (typeof tamilNaduDistricts)[number]) ||
      contact.state !== "Tamil Nadu"
    ) {
      return "Delivery is currently available only to Tamil Nadu districts.";
    }
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!demoMode && !settings.paymentsReady) {
      setError(
        "Razorpay test keys are not configured on this deployment. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then redeploy.",
      );
      return;
    }

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    let created: { order: Order } | undefined;

    try {
      created = await apiPost<{ order: Order }>("/api/orders", {
        contact,
        expectedTotal: total,
        items: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.qty,
        })),
      });

      const customerCode = created.order.customerCode;
      rememberCustomerCode(customerCode);
      rememberOrderCode(created.order.orderNumber, customerCode);

      if (demoMode) {
        clearCart();
        navigate(
          `/order/${created.order.orderNumber}?code=${encodeURIComponent(customerCode)}&notice=demo`,
          { replace: true },
        );
        return;
      }

      // The order is saved first; the Razorpay order is created separately so a
      // gateway error still leaves the customer with a reachable order page.
      const session = await createPaymentSession(created.order.orderNumber, customerCode);
      const callback = await openRazorpayCheckout({
        session,
        storeName: settings.storeName,
        description: `${lines.length} print${lines.length === 1 ? "" : "s"} · ${settings.storeName}`,
      });

      const order = await verifyRazorpayPayment(callback);
      clearCart();
      navigate(`/order/${order.orderNumber}?code=${encodeURIComponent(customerCode)}`, {
        replace: true,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Payment failed.";

      // A 409 means the server repriced the cart (for example an offer ended).
      // Refresh the catalogue so the customer sees the new total before retrying.
      if (caught instanceof ApiError && caught.status === 409) {
        await Promise.all([fetchProducts(), fetchSettings()]);
      }

      // The order is already saved centrally; send the customer to its status
      // page instead of losing the reference when checkout is dismissed.
      if (created) {
        const notice =
          message === "cancelled" ? "cancelled" : message.includes("failed") ? "failed" : "pending";
        navigate(
          `/order/${created.order.orderNumber}?code=${encodeURIComponent(
            created.order.customerCode,
          )}&notice=${notice}`,
        );
        return;
      }

      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-24">
      <h1 className="text-[clamp(24px,3.4vw,32px)]">Checkout</h1>
      <p className="mt-1 text-[12.5px] text-white/45">
        {demoMode
          ? "Preview checkout only. This creates a sample order in this browser and does not collect payment."
          : "Delivery details, then payment. Nothing is charged until you confirm in Razorpay."}
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="glass liquid-edge rounded-2xl p-5 md:p-6">
          <h2 className="text-[15px]">Delivery details</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="field" value={contact.name} onChange={setField("name")} placeholder="Aarav Menon" autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input id="phone" className="field" value={contact.phone} onChange={setField("phone")} placeholder="98400 11288" inputMode="tel" autoComplete="tel" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" className="field" type="email" value={contact.email} onChange={setField("email")} placeholder="you@example.in" autoComplete="email" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="address">Address</label>
              <input id="address" className="field" value={contact.address} onChange={setField("address")} placeholder="Flat / street / landmark" autoComplete="street-address" />
            </div>
            <div>
              <label className="label" htmlFor="city">District</label>
              <select id="city" className="field" value={contact.city} onChange={(event) => setContact((current) => ({ ...current, city: event.target.value }))} autoComplete="address-level2">
                {tamilNaduDistricts.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="state">State</label>
              <input id="state" className="field" value="Tamil Nadu" readOnly autoComplete="address-level1" />
            </div>
            <div>
              <label className="label" htmlFor="postalCode">PIN code</label>
              <input id="postalCode" className="field" value={contact.postalCode} onChange={setField("postalCode")} placeholder="600041" inputMode="numeric" maxLength={6} autoComplete="postal-code" />
            </div>
            <label className="sm:col-span-2 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
              <input
                type="checkbox"
                checked={contact.marketingOptIn}
                onChange={(event) => setContact((current) => ({ ...current, marketingOptIn: event.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
              />
              <span>Send me product news, offers and updates by email. This is optional and can be changed by contacting the store.</span>
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
              {error}
            </p>
          )}
        </div>

        <div className="glass liquid-edge h-fit rounded-2xl p-5">
          <h2 className="text-[15px]">Order</h2>

          <div className="mt-3 grid gap-2">
            {lines.map((line) => (
              <div key={line.product.id} className="flex justify-between gap-2 text-[12px]">
                <span className="truncate text-white/60">
                  {line.product.name} <span className="text-white/30">× {line.qty}</span>
                </span>
                <span className="num shrink-0 text-white/80">{inr(line.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-[12.5px]">
            <div className="flex justify-between text-white/55">
              <span>Subtotal</span>
              <span className="num text-white/85">{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-white/55">
              <span>Shipping</span>
              <span className="num text-white/85">{shipping === 0 ? "Free" : inr(shipping)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[15px] font-semibold">
              <span>Total</span>
              <span className="num text-white">{inr(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !settings.paymentsReady}
            className="btn-primary mt-5 w-full py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> Pay {inr(total)}
              </>
            )}
          </button>

          <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-white/35">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {settings.paymentsReady
              ? "Secured by Razorpay TEST mode. We never see or store your card details. Use a Razorpay test card/UPI ID — no real money moves."
              : "Razorpay TEST keys are not configured. Checkout is disabled until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set."}
          </p>
        </div>
      </form>
    </div>
  );
}
