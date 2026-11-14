/**
 * Admin ratings & reviews.
 *
 * New customer reviews are flagged unseen until this screen loads. The admin
 * can reply as the configured admin email; the reply appears on the storefront
 * and is sent to the customer's web inbox (plus WhatsApp when configured).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Loader2, MessageSquare, Search, Star, Trash2 } from "lucide-react";
import { Stars } from "@/components/ProductReviews";
import { shortDate } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  deleteReview,
  getReviews,
  replyToReview,
  setReviewStatus,
  type AdminReview,
} from "@/lib/admin";

type Filter = "all" | "unread" | "low" | "unanswered";

export function AdminReviews() {
  const toast = useToast((state) => state.push);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [adminName, setAdminName] = useState("admin@zencmart");
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getReviews();
      setReviews(response.reviews ?? []);
      setUnreadCount(response.unreadCount ?? 0);
      setAdminName(response.adminName || "admin@zencmart");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reviews.filter((review) => {
      if (filter === "unread" && review.adminSeen) return false;
      if (filter === "low" && (review.rating ?? 5) > 2) return false;
      if (filter === "unanswered" && review.adminReply) return false;
      if (filter === "unanswered" && review.isAdmin) return false;
      if (needle && !`${review.authorName} ${review.productName} ${review.title} ${review.body}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [filter, query, reviews]);

  const average = reviews.length
    ? reviews.filter((review) => review.rating !== null).reduce((sum, review) => sum + (review.rating ?? 0), 0) /
      Math.max(1, reviews.filter((review) => review.rating !== null).length)
    : 0;

  const reply = async (review: AdminReview) => {
    if (replyText.trim().length < 2) {
      toast("Write a reply before sending it.", "warn");
      return;
    }
    setSavingReply(true);
    try {
      const result = await replyToReview(review.id, replyText.trim());
      if (result.review) {
        setReviews((current) => current.map((item) => (item.id === review.id ? result.review as AdminReview : item)));
      }
      setReplyId(null);
      setReplyText("");
      toast(
        result.notifications.whatsapp === "sent"
          ? "Reply published and sent to the customer's WhatsApp."
          : result.notifications.whatsapp === "failed"
            ? "Reply published in the storefront, but WhatsApp delivery failed."
            : "Reply published in the customer's storefront inbox.",
        result.notifications.whatsapp === "failed" ? "warn" : "success",
      );
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not send the reply", "error");
    } finally {
      setSavingReply(false);
    }
  };

  const toggleStatus = async (review: AdminReview) => {
    setBusyId(review.id);
    try {
      const next = review.status === "hidden" ? "published" : "hidden";
      await setReviewStatus(review.id, next);
      setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, status: next } : item)));
      toast(next === "hidden" ? "Review hidden from the storefront" : "Review published", "success");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not update the review", "error");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (review: AdminReview) => {
    if (!window.confirm(`Delete the review by ${review.authorName}? This cannot be undone.`)) return;
    setBusyId(review.id);
    try {
      await deleteReview(review.id);
      setReviews((current) => current.filter((item) => item.id !== review.id));
      toast("Review deleted", "success");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not delete the review", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Community</p>
          <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Ratings & reviews</h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {reviews.length} reviews · {unreadCount} new · average {average.toFixed(1)} / 5
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/45">
          Replying as <span className="font-mono text-white/75">{adminName}</span>
        </div>
      </div>

      <div className="glass mb-4 grid gap-2 rounded-2xl p-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, customer or review text"
            className="field pl-9"
            aria-label="Search reviews"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["all", "All"],
            ["unread", "New"],
            ["low", "Low ratings"],
            ["unanswered", "Unanswered"],
          ] as [Filter, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                filter === id
                  ? "border-transparent bg-violet-400 text-ink-950"
                  : "border-white/12 bg-white/[0.04] text-white/60 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">{error}</p>
      )}

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-[12px] text-white/45">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading reviews…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-[12px] text-white/45">
          No reviews match this filter yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((review) => {
            const hidden = review.status === "hidden";
            return (
              <article
                key={review.id}
                className={`glass rounded-2xl p-4 ${review.adminSeen ? "" : "border-violet-300/40 bg-violet-400/[0.04]"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!review.adminSeen && (
                        <span className="rounded-full bg-violet-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-950">New</span>
                      )}
                      <span className="text-[12.5px] font-semibold text-white/85">{review.authorName}</span>
                      {review.rating !== null && <Stars value={review.rating} />}
                      {hidden && <span className="rounded-full border border-coral/30 bg-coral/10 px-2 py-0.5 text-[9px] font-bold uppercase text-coral">Hidden</span>}
                    </div>
                    <p className="mt-1 text-[11px] text-white/40">
                      {review.productName} · {shortDate(review.createdAt)}
                      {review.customerPhone ? ` · ${review.customerPhone}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleStatus(review)}
                      disabled={busyId === review.id}
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                      title={hidden ? "Publish review" : "Hide from storefront"}
                    >
                      {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(review)}
                      disabled={busyId === review.id}
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-coral/10 hover:text-coral disabled:opacity-40"
                      title="Delete review"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {review.title && <p className="mt-2 text-[12.5px] font-semibold text-white/80">{review.title}</p>}
                <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-white/55">{review.body}</p>

                {review.adminReply && (
                  <div className="mt-2.5 rounded-xl border border-violet-300/20 bg-violet-400/[0.06] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-violet-200">
                      <Check className="h-3 w-3" /> Reply from {adminName}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-white/60">{review.adminReply}</p>
                  </div>
                )}

                {!review.isAdmin && (
                  replyId === review.id ? (
                    <div className="mt-3">
                      <textarea
                        className="field min-h-[84px] resize-y"
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        placeholder={`Reply publicly as ${adminName}…`}
                        maxLength={2000}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="btn-primary !px-3.5 !py-2 text-[11.5px]"
                          disabled={savingReply}
                          onClick={() => void reply(review)}
                        >
                          {savingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                          Send reply
                        </button>
                        <button type="button" className="btn-glass !px-3.5 !py-2 text-[11.5px]" onClick={() => { setReplyId(null); setReplyText(""); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-violet-200 hover:underline"
                      onClick={() => { setReplyId(review.id); setReplyText(review.adminReply ?? ""); }}
                    >
                      <Star className="h-3.5 w-3.5" /> {review.adminReply ? "Edit reply" : "Reply as studio"}
                    </button>
                  )
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
