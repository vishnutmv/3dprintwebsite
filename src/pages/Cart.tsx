/**
 * Cart page — line items, quantity controls, shipping threshold and totals.
 */

import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
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

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28">
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
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-24">
      <h1 className="text-[clamp(24px,3.4vw,32px)]">Your cart</h1>
      <p className="mt-1 text-[12.5px] text-white/45">
        {lines.length} {lines.length === 1 ? "line item" : "line items"}
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-3">
          {lines.map((line) => (
            <div key={line.product.id} className="glass flex gap-4 rounded-2xl p-3.5">
              <div
                className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl"
                style={{
                  background: `radial-gradient(120% 120% at 30% 0%, ${line.product.accent}44, transparent 62%), linear-gradient(160deg,#150c2c,#0b0718)`,
                }}
              >
                {line.product.imageUrl ? (
                  <img
                    src={line.product.imageUrl}
                    alt={line.product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="h-9 w-9 rounded-[28%]"
                    style={{ background: line.product.accent }}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/product/${line.product.slug}`}
                      className="block truncate text-[13.5px] font-semibold text-white hover:text-violet-200"
                    >
                      {line.product.name}
                    </Link>
                    <p className="text-[11px] text-white/35">
                      {line.product.category} · {line.product.material}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(line.product.id)}
                    className="rounded-lg p-1 text-white/30 transition hover:bg-coral/10 hover:text-coral"
                    aria-label={`Remove ${line.product.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                    <button
                      type="button"
                      onClick={() => setQty(line.product.id, line.qty - 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="num w-7 text-center text-[12.5px]">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(line.product.id, line.qty + 1)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="num text-[14px] font-semibold text-white">{inr(line.lineTotal)}</p>
                    <p className="text-[10.5px] text-white/35">{inr(effectiveProductPrice(line.product, now))} each</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass liquid-edge h-fit rounded-2xl p-5">
          <h2 className="text-[15px]">Order summary</h2>

          <div className="mt-4 space-y-2 text-[12.5px]">
            <div className="flex justify-between text-white/55">
              <span>Subtotal</span>
              <span className="num text-white/85">{inr(subtotal)}</span>
            </div>
            <div className="flex justify-between text-white/55">
              <span>Shipping</span>
              <span className="num text-white/85">{shipping === 0 ? "Free" : inr(shipping)}</span>
            </div>
            {toFreeShipping > 0 && (
              <p className="rounded-xl border border-sun/25 bg-sun/[0.06] px-3 py-2 text-[11px] text-sun/85">
                Add {inr(toFreeShipping)} more for free shipping.
              </p>
            )}
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-[14px] font-semibold">
              <span>Total</span>
              <span className="num text-white">{inr(total)}</span>
            </div>
          </div>

          <Link to="/checkout" className="btn-primary mt-5 w-full py-3.5">
            Checkout
          </Link>
          <Link
            to="/shop"
            className="mt-2 block text-center text-[11.5px] text-white/40 hover:text-white"
          >
            Continue shopping
          </Link>

          <p className="mt-4 text-center text-[10.5px] leading-relaxed text-white/30">
            {settings.paymentsReady
              ? "Payments are processed by Razorpay TEST mode. No real money moves."
              : "Checkout is disabled until Razorpay test keys are configured."}
          </p>
        </div>
      </div>
    </div>
  );
}
