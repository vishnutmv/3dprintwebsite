import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Clock3, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { inr } from "@/lib/format";
import { promotionState, serverNow } from "@/lib/promotions";
import type { Product } from "@/lib/types";

export function PromotionBanner({ products }: { products: Product[] }) {
  const [now, setNow] = useState(serverNow());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(serverNow()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const offer = useMemo(() => products
    .filter((product) => product.stock > 0 && promotionState(product, now) !== "none" && promotionState(product, now) !== "ended")
    .sort((a, b) => {
      const stateA = promotionState(a, now) === "active" ? 0 : 1;
      const stateB = promotionState(b, now) === "active" ? 0 : 1;
      if (stateA !== stateB) return stateA - stateB;
      return Date.parse(a.promotionStartAt ?? "") - Date.parse(b.promotionStartAt ?? "");
    })[0], [now, products]);

  if (!offer || !offer.promotionPrice || !offer.promotionStartAt || !offer.promotionEndAt) return null;

  const active = promotionState(offer, now) === "active";
  const target = Date.parse(active ? offer.promotionEndAt : offer.promotionStartAt);
  const seconds = Math.max(0, Math.floor((target - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return (
    <Link
      to={`/product/${offer.slug}`}
      className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/25 bg-coral/[0.08] px-4 py-3 transition hover:border-coral/45 hover:bg-coral/[0.12]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral/15 text-coral">
          <Tag className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-coral">
            {active ? "Live offer" : "Upcoming offer"}
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-white">
            {offer.name} · {inr(offer.promotionPrice)}
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2 text-[11px] font-semibold text-white/75">
        <Clock3 className="h-4 w-4 text-coral" />
        {active ? "Ends" : "Starts"} in {hours}h {String(minutes).padStart(2, "0")}m {String(remainingSeconds).padStart(2, "0")}s
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
