/**
 * Public testimonials — recent 4★+ customer reviews across the catalogue.
 * New visitors can read these without signing in.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Quote } from "lucide-react";
import { Stars } from "./ProductReviews";
import { getFeaturedReviews } from "@/lib/social";
import { shortDate } from "@/lib/format";
import type { ProductReview } from "@/lib/types";

export function Testimonials() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);

  useEffect(() => {
    getFeaturedReviews(6)
      .then((items) => setReviews(items.filter((review) => (review.rating ?? 0) >= 4 && review.body.trim() !== "")))
      .catch((error) => console.error("Could not load testimonials:", error));
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">Testimonials</p>
          <h2 className="mt-1.5 text-[clamp(22px,3vw,30px)]">Loved by the studio community</h2>
          <p className="mt-1 text-[12.5px] text-white/45">
            Real ratings and comments from customers. Sign in to join the conversation.
          </p>
        </div>
        <Link to="/shop" className="btn-glass btn-sm text-[12px]">Shop rated prints</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {reviews.slice(0, 3).map((review) => (
          <figure key={review.id} className="glass flex flex-col rounded-2xl p-5">
            <Quote className="h-5 w-5 text-violet-300" />
            <Stars value={review.rating ?? 0} className="mt-3 h-4 w-4" />
            {review.title && <p className="mt-2 text-[13px] font-semibold text-white">{review.title}</p>}
            <blockquote className="mt-1.5 line-clamp-4 text-[12.5px] leading-relaxed text-white/55">
              {review.body}
            </blockquote>
            <figcaption className="mt-auto border-t border-white/8 pt-3 text-[11px] text-white/40">
              <span className="font-semibold text-white/70">{review.authorName}</span>
              {review.productSlug && review.productName ? (
                <> · <Link to={`/product/${review.productSlug}`} className="text-violet-200 hover:underline">{review.productName}</Link></>
              ) : null}
              <span className="block text-[10px] text-white/25">{shortDate(review.createdAt)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
