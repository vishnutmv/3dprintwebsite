/**
 * Shared UI atoms — status pill, empty state, section heading.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-sun/30 bg-sun/10 text-sun",
  confirmed: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  paid: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  processing: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  packed: "border-sun/30 bg-sun/10 text-sun",
  failed: "border-coral/30 bg-coral/10 text-coral",
  refunded: "border-white/15 bg-white/[0.06] text-white/60",
  shipped: "border-mint/30 bg-mint/10 text-mint",
  delivered: "border-mint/40 bg-mint/15 text-mint",
  cancelled: "border-coral/30 bg-coral/10 text-coral",
  open: "border-mint/30 bg-mint/10 text-mint",
  awarded: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  claimed: "border-white/15 bg-white/[0.06] text-white/60",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em]",
        STATUS_STYLES[status] ?? "border-white/15 bg-white/[0.06] text-white/60",
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass liquid-edge rounded-3xl p-10 text-center">
      <h2 className="text-[22px]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-white/50">{copy}</p>
      {action}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300">{eyebrow}</p>
      <h1 className="mt-2 text-[clamp(24px,3.4vw,32px)]">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/45">{copy}</p>
    </div>
  );
}
