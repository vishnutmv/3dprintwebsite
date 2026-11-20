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
    <section className="amz-card p-4 sm:p-5">
      <div className="amz-row-head mb-4">
        <div>
          <h2 className="amz-section-title">Customer reviews</h2>
          <p className="mt-1 text-[12.5px] text-[color:var(--muted)]">
            Real ratings and comments from customers. Sign in to join the conversation.
          </p>
        </div>
        <Link to="/shop" className="amz-link hidden shrink-0 text-[13px] sm:block">
          Shop rated prints
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {reviews.slice(0, 3).map((review) => (
          <figure key={review.id} className="flex flex-col rounded-md border border-[color:var(--border)] p-4">
            <Quote className="h-5 w-5 text-[color:var(--accent)]" />
            <Stars value={review.rating ?? 0} className="mt-3 h-4 w-4" />
            {review.title && <p className="mt-2 text-[13px] font-semibold text-white">{review.title}</p>}
            <blockquote className="mt-1.5 line-clamp-4 text-[12.5px] leading-relaxed text-white/55">
              {review.body}
            </blockquote>
            <figcaption className="mt-auto border-t border-white/8 pt-3 text-[11px] text-white/40">
              <span className="font-semibold text-white/70">{review.authorName}</span>
              {review.productSlug && review.productName ? (
                <> · <Link to={`/product/${review.productSlug}`} className="text-violet-200 underline underline-offset-2 decoration-current/50 hover:decoration-current">{review.productName}</Link></>
              ) : null}
              <span className="block text-[10px] text-white/25">{shortDate(review.createdAt)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
