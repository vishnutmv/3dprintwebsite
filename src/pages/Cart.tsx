/**
 * Cart page — line items, quantity controls, shipping threshold and totals.
 */

import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, Lock, Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { inr } from "@/lib/format";
import { effectiveProductPrice, usePromotionClock } from "@/lib/promotions";
import { cartLines, useStore } from "@/lib/store";

export function Cart() {
  const cart = useStore((state) => state.cart);
  const products = useStore((state) => state.products);
  const settings = useStore((state) => state.settings);
  const setQty = useStore((state) => state.setQty);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const now = usePromotionClock();

  const lines = cartLines({ cart, products }, now);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = subtotal === 0 || subtotal >= settings.freeShippingOver ? 0 : settings.shippingFlat;
  const total = subtotal + shipping;
  const toFreeShipping = settings.freeShippingOver - subtotal;
  const progress =
    settings.freeShippingOver > 0
      ? Math.min(100, Math.round((subtotal / settings.freeShippingOver) * 100))
      : 100;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28">
        <h1 className="sr-only">Your cart</h1>
        <EmptyState
          title="Your cart is empty"
          copy="Nothing has been added yet. The catalogue has stock pieces and made-to-order work."
          action={
            <Link to="/shop" className="btn-primary mx-auto mt-5 inline-flex">
              <ShoppingBag className="h-4 w-4" /> Browse the catalogue
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-3 pb-10 pt-4 sm:px-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-[color:var(--faint)]">
        <Link to="/" className="hover:text-[color:var(--text)]">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[color:var(--text)]">Cart</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(26px,3.8vw,36px)]">
            Your Cart <span className="text-[color:var(--accent)]">({lines.length})</span>
          </h1>
          <p className="mt-1 text-[12.5px] text-[color:var(--muted)]">
            {lines.reduce((sum, line) => sum + line.qty, 0)} items ready to print.
          </p>
        </div>
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Continue shopping
        </Link>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="grid gap-3">
          {lines.map((line) => (
            <div
              key={line.product.id}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3.5 sm:p-4"
            >
              <div className="flex gap-3.5 sm:gap-4">
                <Link
                  to={`/product/${line.product.slug}`}
                  className="grid h-[74px] w-[74px] shrink-0 place-items-center overflow-hidden rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-soft)] sm:h-[88px] sm:w-[88px]"
                  aria-label={`View ${line.product.name}`}
                >
                  {line.product.imageUrl ? (
                    <img src={line.product.imageUrl} alt={line.product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="h-9 w-9 rounded-[26%]"
                      style={{ background: line.product.accent }}
                    />
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--faint)]">
                        {line.product.category}
                      </p>
                      <Link
                        to={`/product/${line.product.slug}`}
                        className="mt-0.5 block truncate text-[13.5px] font-semibold text-[color:var(--heading)] hover:text-[color:var(--accent)]"
                      >
                        {line.product.name}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                        {line.product.material}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line.product.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[color:var(--faint)] transition hover:bg-[color:var(--surface-deep)] hover:text-[color:var(--coral)]"
                      aria-label={`Remove ${line.product.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                    <div className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
                      <button
                        type="button"
                        onClick={() => setQty(line.product.id, line.qty - 1)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--heading)]"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="num w-7 text-center text-[12px] font-semibold">{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(line.product.id, line.qty + 1)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--heading)]"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="num text-[15px] font-semibold text-[color:var(--heading)]">
                        {inr(line.lineTotal)}
                      </p>
                      <p className="text-[10px] text-[color:var(--faint)]">
                        {inr(effectiveProductPrice(line.product, now))} each
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ffd814] text-[#111311]">
                <Truck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-[color:var(--heading)]">
                  {toFreeShipping > 0 ? `Add ${inr(toFreeShipping)} more for free shipping` : "Free shipping unlocked"}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-deep)]">
                  <div
                    className="h-full rounded-full bg-[#e6b800] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5 lg:sticky lg:top-[124px]">
          <h2 className="text-[15px]">Order Summary</h2>

          <div className="mt-4 space-y-2.5 text-[12.5px]">
            <div className="flex justify-between text-[color:var(--muted)]">
              <span>Subtotal</span>
              <span className="num font-medium text-[color:var(--text)]">{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[color:var(--muted)]">
              <span>Shipping</span>
              <span className="num font-medium text-[color:var(--text)]">
                {shipping === 0 ? "Free" : inr(shipping)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-[color:var(--border)] pt-3 text-[15px] font-bold">
              <span>Total</span>
              <span className="num text-[color:var(--heading)]">{inr(total)}</span>
            </div>
          </div>

          <Link to="/checkout" className="btn-primary mt-5 w-full py-3.5">
            Proceed to Checkout <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10.5px] text-[color:var(--faint)]">
            <Lock className="h-3 w-3" /> Secure checkout powered by Razorpay
          </p>

          <p className="mt-3 border-t border-[color:var(--border-soft)] pt-3 text-center text-[10px] leading-relaxed text-[color:var(--faint)]">
            {settings.paymentsReady
              ? "Payments are processed by Razorpay TEST mode. No real money moves."
              : "Checkout is disabled until Razorpay test keys are configured."}
          </p>
        </div>
      </div>
    </div>
  );
}
