/**
 * Product card — Amazon-style catalogue tile: image, two-line title, rating,
 * price with discount, delivery line and a yellow add-to-cart action.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { inr } from "@/lib/format";
import { flyToCart } from "@/lib/cart-fly";
import { useAccount } from "@/lib/account";
import { useSocial } from "@/lib/social";
import { useToast } from "@/lib/toast";
import { effectiveProductPrice, promotionState, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

function RatingStars({ rating, reviews }: { rating: number; reviews: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="flex items-center gap-1 text-[12px]">
      <span className="flex items-center" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            className="h-3.5 w-3.5"
            strokeWidth={0}
            fill={value <= rounded ? "#de7921" : "#d5d9d9"}
          />
        ))}
      </span>
      <span className="num font-medium text-[#007185] hover:text-[#c7511f]">{reviews}</span>
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const now = usePromotionClock();
  const price = effectiveProductPrice(product, now);
  const onOffer = promotionState(product, now) === "active";
  const original = onOffer ? product.price : product.mrp;
  const discount = original && original > price ? Math.round((1 - price / original) * 100) : 0;
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
    <article className="product-card h-full">
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
                  className="relative h-20 w-20 rounded-[26%] transition-transform duration-500 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(150deg, ${product.accent}, ${product.accent}77)`,
                    boxShadow: `inset 0 2px 0 rgba(255,255,255,.5), inset 0 -16px 26px rgba(0,0,0,.12)`,
                  }}
                >
                  <span className="absolute inset-x-4 bottom-3 h-px rounded bg-white/45" />
                  <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-white/75" />
                </div>
              </div>
            )}

            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              {discount > 0 && (
                <span className="rounded-sm bg-[#cc0c39] px-1.5 py-0.5 text-[11px] font-bold text-white">
                  -{discount}%
                </span>
              )}
              {product.badge && (
                <span className="rounded-sm bg-[#ffd814] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#0f1111]">
                  {product.badge}
                </span>
              )}
              {product.trendTag && (
                <span className="rounded-sm bg-[#f7f8f8] px-1.5 py-0.5 text-[10px] font-bold text-[#565959]">
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
            className={`absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border shadow-sm transition ${
              isFavorite
                ? "border-[#ffa41c] bg-[#fff3e0] text-[#c45500]"
                : "border-[color:var(--border)] bg-white/90 text-[#565959] hover:text-[#c45500]"
            }`}
            aria-label={isFavorite ? `Remove ${product.name} from favourites` : `Add ${product.name} to favourites`}
            title={isFavorite ? "Remove from favourites" : "Add to favourites"}
          >
            <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <Link to={`/product/${product.slug}`} className="block">
          <h3 className="product-title">{product.name}</h3>
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <RatingStars rating={product.rating} reviews={product.reviews} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="product-price num text-[18px]">{inr(price)}</span>
          {discount > 0 && original && (
            <span className="num text-[12px] text-[#565959] line-through">{inr(original)}</span>
          )}
        </div>

        <p className="mt-1 text-[11.5px] leading-snug text-[#565959]">
          {product.stock > 0 ? (
            <>
              <span className="font-semibold text-[#0f1111]">FREE delivery</span> on qualifying orders
            </>
          ) : (
            <span className="font-semibold text-[#b12704]">Currently unavailable</span>
          )}
        </p>

        <button
          type="button"
          onClick={add}
          disabled={product.stock <= 0}
          className="add-cart-fab mt-2.5 w-full"
          aria-label={product.stock > 0 ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
        >
          {product.stock > 0 ? "Add to cart" : "Out of stock"}
        </button>
      </div>
    </article>
  );
}
