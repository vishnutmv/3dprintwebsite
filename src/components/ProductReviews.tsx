/**
 * Product ratings, customer reviews and the admin reply thread.
 * Reading is public; writing needs a signed-in customer.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BadgeCheck, Loader2, MessageSquare, Star } from "lucide-react";
import { useAccount } from "@/lib/account";
import { createProductReview, getProductReviews } from "@/lib/social";
import { shortDate } from "@/lib/format";
import { useToast } from "@/lib/toast";
import type { Product, ProductReview, ReviewSummary } from "@/lib/types";

const emptySummary: ReviewSummary = {
  average: 0,
  count: 0,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
};

export function Stars({ value, className = "h-3.5 w-3.5" }: { value: number; className?: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${value.toFixed(1).replace(/\.0$/, "")} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, value - (star - 1)));
        return (
          <span key={star} className="relative inline-block shrink-0">
            <Star className={`${className} text-white/20`} strokeWidth={1.5} />
            <span
              aria-hidden
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className={`${className} fill-current text-sun`} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Interactive half-star picker. Starts empty, fills on hover and accepts
 * whole or half values between 1 and 5.
 */
function RatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;

  const valueAt = (event: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>, star: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const leftHalf = event.clientX - rect.left < rect.width / 2;
    return Math.max(1, leftHalf ? star - 0.5 : star);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Your rating out of 5 stars"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value || 1}
        aria-valuetext={value ? `${value} out of 5` : "No rating selected"}
        className="flex items-center gap-0.5 rounded-lg"
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(Math.min(5, (value || 0.5) + 0.5));
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(Math.max(1, (value || 1) - 0.5));
          } else if (event.key === "Home") {
            event.preventDefault();
            onChange(1);
          } else if (event.key === "End") {
            event.preventDefault();
            onChange(5);
          }
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, shown - (star - 1)));
          return (
            <button
              key={star}
              type="button"
              aria-label={`Set rating to ${star === 1 ? "1" : `${star - 0.5} or ${star}`} star${star === 1 ? "" : "s"}`}
              onClick={(event) => onChange(valueAt(event, star))}
              onPointerMove={(event) => setHover(valueAt(event, star))}
              className="relative rounded-md p-0.5 transition-transform duration-150 hover:scale-110 focus-visible:scale-110"
            >
              <Star className="h-7 w-7 text-white/20" strokeWidth={1.5} />
              <span
                aria-hidden
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className="h-7 w-7 shrink-0 fill-current text-sun" strokeWidth={1.5} />
              </span>
            </button>
          );
        })}
      </div>
      <span className="text-[11px] font-semibold text-white/45">
        {shown > 0 ? `${shown} / 5` : "Select a rating"}
      </span>
      {value > 0 && (
        <button type="button" onClick={() => onChange(0)} className="text-[10.5px] text-white/35 underline underline-offset-2 hover:text-white/60">
          Clear
        </button>
      )}
    </div>
  );
}

export function ProductReviews({ product }: { product: Product }) {
  const customer = useAccount((state) => state.customer);
  const location = useLocation();
  const pushToast = useToast((state) => state.push);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(emptySummary);
  const [adminName, setAdminName] = useState("admin@zencmart");
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const loginHref = `/account?next=${encodeURIComponent(location.pathname)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getProductReviews(product.id);
      setReviews(response.reviews ?? []);
      setSummary(response.summary ?? emptySummary);
      setAdminName(response.adminName || "admin@zencmart");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (rating < 1) {
      setError("Choose a rating before publishing.");
      return;
    }
    if (body.trim().length < 4) {
      setError("Write a sentence or two about the product.");
      return;
    }
    setSaving(true);
    try {
      const response = await createProductReview(product.id, { rating, title: title.trim(), body: body.trim() });
      setSummary(response.summary);
      setTitle("");
      setBody("");
      setRating(0);
      pushToast("Review published. Thank you!", "success");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish your review.");
    } finally {
      setSaving(false);
    }
  };

  const maxCount = Math.max(1, ...Object.values(summary.distribution));

  return (
    <section className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="glass rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">Ratings</p>
        <h2 className="mt-1.5 text-[22px]">What customers say</h2>

        <div className="mt-4 flex items-end gap-3">
          <span className="num text-[38px] font-bold leading-none text-white">{summary.average.toFixed(1)}</span>
          <div className="pb-1">
            <Stars value={summary.average} className="h-4 w-4" />
            <p className="mt-1 text-[11px] text-white/45">{summary.count} {summary.count === 1 ? "rating" : "ratings"}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[String(star) as keyof typeof summary.distribution] ?? 0;
            return (
              <div key={star} className="flex items-center gap-2 text-[10.5px] text-white/45">
                <span className="w-3 text-right">{star}</span>
                <Star className="h-3 w-3 fill-current text-sun" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-sun/70" style={{ width: `${(count / maxCount) * 100}%` }} />
                </span>
                <span className="num w-5 text-right">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 border-t border-white/8 pt-4">
          {customer ? (
            <form onSubmit={submit}>
              <p className="text-[12.5px] font-semibold text-white/85">Rate this print</p>
              <div className="mt-2">
                <RatingInput value={rating} onChange={setRating} />
              </div>
              <input
                className="field mt-3"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Headline (optional)"
                maxLength={160}
              />
              <textarea
                className="field mt-2 min-h-[92px] resize-y"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="How does it look and feel? Was it packed well?"
                maxLength={1200}
                required
              />
              {error && <p className="mt-2 text-[11px] text-coral">{error}</p>}
              <button type="submit" className="btn-primary mt-3 w-full" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Publish review
              </button>
            </form>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[12px] leading-relaxed text-white/50">
                Ratings and reviews are public. Sign in to add yours.
              </p>
              <Link to={loginHref} className="btn-primary mt-3 inline-flex !px-4 !py-2 text-[12px]">
                Sign in to review
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px]">Reviews & comments</h2>
          <span className="text-[11px] text-white/40">{reviews.length} published</span>
        </div>

        {loading ? (
          <p className="mt-5 flex items-center gap-2 text-[12px] text-white/45">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading reviews…
          </p>
        ) : reviews.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-8 text-center">
            <MessageSquare className="mx-auto h-6 w-6 text-white/25" />
            <p className="mt-2 text-[12px] text-white/45">No reviews yet. Be the first to share your experience.</p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-white/6">
            {reviews.map((review) => (
              <article key={review.id} className="py-3.5 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-white/85">{review.authorName}</span>
                    {review.isAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-violet-200">
                        <BadgeCheck className="h-3 w-3" /> Studio
                      </span>
                    )}
                    {review.rating !== null && <Stars value={review.rating} />}
                  </div>
                  <span className="text-[10px] text-white/30">{shortDate(review.createdAt)}</span>
                </div>
                {review.title && <p className="mt-1.5 text-[12.5px] font-semibold text-white/80">{review.title}</p>}
                <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-white/55">{review.body}</p>

                {review.adminReply && (
                  <div className="mt-2.5 rounded-xl border border-violet-300/20 bg-violet-400/[0.06] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">
                      <BadgeCheck className="h-3 w-3" />
                      Reply from {adminName}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-white/60">{review.adminReply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
