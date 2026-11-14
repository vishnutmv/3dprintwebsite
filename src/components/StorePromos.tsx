/**
 * Dynamic storefront advertising.
 *
 * Messages are derived from live catalogue data (active promotions, discounts,
 * trend tags, stock) plus a rolling one-hour rewards window. Nothing is
 * hard-coded per product, so new offers and trending items appear automatically.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Flame, Gift, Percent, Sparkles, Tag } from "lucide-react";
import { inr } from "@/lib/format";
import { effectiveProductPrice, promotionState, serverNow, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";

type Promo = {
  id: string;
  icon: typeof Tag;
  eyebrow: string;
  text: string;
  to: string;
};

export function StorePromos() {
  const products = useStore((state) => state.products) ?? [];
  const settings = useStore((state) => state.settings);
  const now = usePromotionClock();
  const [index, setIndex] = useState(0);

  const promos = useMemo<Promo[]>(() => {
    const list: Promo[] = [];

    const activeOffers = products
      .filter((product) => product.stock > 0 && promotionState(product, now) === "active")
      .sort((a, b) => (a.promotionEndAt ?? "").localeCompare(b.promotionEndAt ?? ""));
    for (const product of activeOffers.slice(0, 3)) {
      const endsAt = Date.parse(product.promotionEndAt ?? "");
      const minutes = Number.isFinite(endsAt) ? Math.max(0, Math.round((endsAt - now) / 60_000)) : 0;
      list.push({
        id: `offer-${product.id}`,
        icon: Tag,
        eyebrow: minutes > 0 ? `Offer ends in ${minutes} min` : "Limited-time offer",
        text: `${product.name} is on sale at ${inr(effectiveProductPrice(product, now))}`,
        to: `/product/${product.slug}`,
      });
    }

    const discounts = products
      .filter((product) => product.mrp && product.mrp > effectiveProductPrice(product, now) && product.stock > 0)
      .sort((a, b) => (b.mrp ?? 0) - effectiveProductPrice(b, now) - ((a.mrp ?? 0) - effectiveProductPrice(a, now)))
      .slice(0, 2);
    for (const product of discounts) {
      const off = Math.round((1 - effectiveProductPrice(product, now) / (product.mrp ?? 1)) * 100);
      list.push({
        id: `discount-${product.id}`,
        icon: Percent,
        eyebrow: off > 0 ? `${off}% off` : "Discounted price",
        text: `${product.name} — buy this at ${inr(effectiveProductPrice(product, now))}`,
        to: `/product/${product.slug}`,
      });
    }

    const trending = products
      .filter((product) => product.stock > 0 && (product.trendTag || (product.recentSoldCount ?? 0) >= 3))
      .slice(0, 2);
    for (const product of trending) {
      list.push({
        id: `trend-${product.id}`,
        icon: Flame,
        eyebrow: product.trendTag || `${product.recentSoldCount} sold recently`,
        text: `Try this next — ${product.name}`,
        to: `/product/${product.slug}`,
      });
    }

    const suggestion = products.find(
      (product) => product.stock > 0 && !activeOffers.some((offer) => offer.id === product.id),
    );
    if (suggestion) {
      list.push({
        id: `try-${suggestion.id}`,
        icon: Sparkles,
        eyebrow: "Studio pick",
        text: `New here? Try ${suggestion.name} for ${inr(effectiveProductPrice(suggestion, now))}`,
        to: `/product/${suggestion.slug}`,
      });
    }

    list.push({
      id: "rewards-window",
      icon: Gift,
      eyebrow: "Next hour reward",
      text: `Order within the next hour over ${inr(settings.freeShippingOver)} to unlock new gift rewards`,
      to: "/rewards",
    });

    return list;
  }, [products, settings.freeShippingOver, now]);

  useEffect(() => {
    if (index >= promos.length) setIndex(0);
  }, [index, promos.length]);

  useEffect(() => {
    if (promos.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % promos.length), 5500);
    return () => window.clearInterval(timer);
  }, [promos.length]);

  const promo = promos[index];
  if (!promo) return null;
  const minutesLeft = 60 - new Date(serverNow()).getUTCMinutes();

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/25 bg-violet-400/[0.07] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-400/15 text-violet-200">
          <promo.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-violet-300">{promo.eyebrow}</p>
          <Link to={promo.to} className="mt-0.5 block truncate text-[12.5px] font-semibold text-white hover:underline">
            {promo.text}
          </Link>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[10.5px] text-white/40">
        <span className="hidden items-center gap-1 sm:flex">
          <Clock3 className="h-3.5 w-3.5" /> Rewards window resets in {minutesLeft} min
        </span>
        <Link to={promo.to} className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink-950">
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
