/**
 * Product card — clickable tile for the catalogue grid.
 * Uses the first InterServer media image when available, otherwise the
 * studio accent placeholder, and keeps the 3D affordance badge.
 */

import { Link } from "react-router-dom";
import { Box, Heart } from "lucide-react";
import { inr } from "@/lib/format";
import { useAccount } from "@/lib/account";
import { useSocial } from "@/lib/social";
import { useToast } from "@/lib/toast";
import { effectiveProductPrice, promotionState, usePromotionClock } from "@/lib/promotions";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const now = usePromotionClock();
  const price = effectiveProductPrice(product, now);
  const onOffer = promotionState(product, now) === "active";
  const customer = useAccount((state) => state.customer);
  const isFavorite = useSocial((state) => state.favorites.includes(product.id));
  const toggleFavorite = useSocial((state) => state.toggleFavorite);
  const pushToast = useToast((state) => state.push);

  const save = async () => {
    try {
      const saved = await toggleFavorite(product);
      pushToast(saved ? `${product.name} saved to favourites` : `${product.name} removed from favourites`, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update favourites", "error");
    }
  };

  return (
    <div className="relative">
      {customer && (
        <button
          type="button"
          onClick={() => void save()}
          className={`absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border shadow-sm backdrop-blur transition ${
            isFavorite
              ? "border-coral/40 bg-coral text-white"
              : "border-white/70 bg-white/85 text-ink-950 hover:bg-white"
          }`}
          aria-label={isFavorite ? `Remove ${product.name} from favourites` : `Add ${product.name} to favourites`}
          title={isFavorite ? "Remove from favourites" : "Add to favourites"}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>
      )}
    <Link
      to={`/product/${product.slug}`}
      className="glass card-lift group flex flex-col overflow-hidden rounded-3xl"
    >
      <div
        className="relative grid h-44 place-items-center overflow-hidden"
        style={{
          background: `radial-gradient(120% 120% at 30% 0%, ${product.accent}22, transparent 62%), linear-gradient(160deg,#f3f0e9,#e7e2d7)`,
        }}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="h-20 w-20 rounded-[28%] opacity-90 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12"
            style={{
              background: `linear-gradient(140deg, ${product.accent}, ${product.accent}66)`,
              boxShadow: `0 20px 60px -20px ${product.accent}`,
            }}
          />
        )}
        {(product.badge || product.trendTag || onOffer) && (
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1 pr-10">
            {onOffer && <span className="rounded-full bg-coral px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">Offer</span>}
            {product.badge && <span className="rounded-full border border-white/20 bg-white/85 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-950 shadow-sm">{product.badge}</span>}
            {product.trendTag && <span className="rounded-full border border-sun/25 bg-ink-950/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-sun shadow-sm">{product.trendTag}</span>}
          </div>
        )}
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/85 px-2 py-1 text-[9.5px] font-semibold text-ink-950 shadow-sm">
          <Box className="h-3 w-3" /> 3D
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          {product.category}
        </p>
        <h3 className="mt-1.5 line-clamp-1 text-[14.5px] font-semibold text-white">
          {product.name}
        </h3>

        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <span className="num text-[16px] font-bold text-white">{inr(price)}</span>
            {(onOffer ? product.price : product.mrp) && (
              <span className="ml-2 text-[11px] text-white/30 line-through">{inr(onOffer ? product.price : product.mrp ?? product.price)}</span>
            )}
          </div>
          <span className="text-[10.5px] text-white/35">
            {product.stock > 0 ? `${product.stock} left` : "Out of stock"}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1 text-[10.5px] text-white/40">
          <span className="text-sun">★</span>
          {product.rating.toFixed(1)}
          <span className="text-white/20">·</span>
          {product.reviews} reviews
        </div>
        {(product.recentSoldCount ?? 0) > 0 && (
          <p className="mt-1 text-[10px] font-medium text-mint/80">
            {product.recentSoldCount} purchased in the last 30 days
          </p>
        )}
      </div>
    </Link>
    </div>
  );
}
