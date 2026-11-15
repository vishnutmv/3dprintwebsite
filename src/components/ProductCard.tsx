/**
 * Product card — catalogue tile with favourite control, live price and a
 * compact add-to-cart action that flies the product image to the header cart.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { Box, Heart, Plus } from "lucide-react";
import { inr } from "@/lib/format";
import { flyToCart } from "@/lib/cart-fly";
import { useAccount } from "@/lib/account";
import { useSocial } from "@/lib/social";
import { useToast } from "@/lib/toast";
import { effectiveProductPrice, promotionState, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const now = usePromotionClock();
  const price = effectiveProductPrice(product, now);
  const onOffer = promotionState(product, now) === "active";
  const customer = useAccount((state) => state.customer);
  const isFavorite = useSocial((state) => state.favorites.includes(product.id));
  const toggleFavorite = useSocial((state) => state.toggleFavorite);
  const addToCart = useStore((state) => state.addToCart);
  const pushToast = useToast((state) => state.push);
  const mediaRef = useRef<HTMLDivElement>(null);

  const save = async () => {
    try {
      const saved = await toggleFavorite(product);
      pushToast(saved ? `${product.name} saved to favourites` : `${product.name} removed from favourites`, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not update favourites", "error");
    }
  };

  const add = () => {
    if (product.stock <= 0) return;
    addToCart(product);
    flyToCart(mediaRef.current, product.imageUrl ?? product.images?.[0]);
    pushToast(`${product.name} added to cart`, "success");
  };

  return (
    <article className="product-card group">
      <div className="relative">
        <Link to={`/product/${product.slug}`} className="block" aria-label={`View ${product.name}`}>
          <div ref={mediaRef} className="product-media">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} loading="lazy" />
            ) : (
              <div className="relative grid place-items-center">
                <span
                  className="absolute h-28 w-28 rounded-full blur-2xl"
                  style={{ background: `${product.accent}44` }}
                  aria-hidden="true"
                />
                <div
                  className="relative h-20 w-20 rounded-[26%] transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
                  style={{
                    background: `linear-gradient(150deg, ${product.accent}, ${product.accent}77)`,
                    boxShadow: `inset 0 2px 0 rgba(255,255,255,.5), inset 0 -16px 26px rgba(0,0,0,.12), 0 24px 38px -18px ${product.accent}`,
                  }}
                >
                  <span className="absolute inset-x-4 bottom-3 h-px rounded bg-white/45" />
                  <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-white/75" />
                </div>
              </div>
            )}

            <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
              {onOffer && (
                <span className="rounded-full bg-[#111311] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#c6ff00]">
                  Offer
                </span>
              )}
              {product.badge && (
                <span className="rounded-full bg-[#c6ff00] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#111311]">
                  {product.badge}
                </span>
              )}
              {product.trendTag && (
                <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[color:var(--text)]">
                  {product.trendTag}
                </span>
              )}
            </div>
          </div>
        </Link>

        {customer && (
          <button
            type="button"
            onClick={() => void save()}
            className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border shadow-sm backdrop-blur transition ${
              isFavorite
                ? "border-transparent bg-[#c6ff00] text-[#111311]"
                : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)] hover:text-[color:var(--heading)]"
            }`}
            aria-label={isFavorite ? `Remove ${product.name} from favourites` : `Add ${product.name} to favourites`}
            title={isFavorite ? "Remove from favourites" : "Add to favourites"}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        )}

        <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-[9px] font-semibold text-[color:var(--muted)]">
          <Box className="h-3 w-3" /> 3D
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[9.5px] font-bold uppercase tracking-[0.16em] text-[color:var(--faint)]">
            {product.category}
          </p>
          <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-medium text-[color:var(--muted)]">
            <span className="text-[#b98a12]">★</span>
            {product.rating.toFixed(1)}
            <span className="text-[color:var(--faint)]">({product.reviews})</span>
          </span>
        </div>

        <Link to={`/product/${product.slug}`} className="mt-1.5 block">
          <h3 className="line-clamp-1 text-[14px] font-semibold text-[color:var(--heading)] transition hover:text-[color:var(--accent)]">
            {product.name}
          </h3>
        </Link>

        <p className="mt-1 line-clamp-1 text-[10.5px] text-[color:var(--faint)]">
          {product.material}
          {product.dimensions ? ` · ${product.dimensions}` : ""}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <p className="product-price num text-[16px]">
              {inr(price)}
            </p>
            {(onOffer ? product.price : product.mrp) && (
              <p className="num text-[10.5px] text-[color:var(--faint)] line-through">
                {inr(onOffer ? product.price : product.mrp ?? product.price)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={add}
            disabled={product.stock <= 0}
            className="add-cart-fab"
            aria-label={product.stock > 0 ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
            title={product.stock > 0 ? "Add to cart" : "Out of stock"}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <p className="mt-1.5 text-[10px] text-[color:var(--faint)]">
          {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
        </p>
      </div>
    </article>
  );
}
