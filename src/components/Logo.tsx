import { Link } from "react-router-dom";
import { cn } from "@/lib/format";

export function Logo({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3">
      <span
        className="relative grid h-10 w-10 place-items-center rounded-2xl text-[13px] font-black text-ink-950 shadow-glow transition-transform duration-300 group-hover:rotate-6"
        style={{ background: "linear-gradient(140deg,#e5dbff,#a78bfa 46%,#7be0b4)" }}
      >
        3D
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[16px] font-extrabold tracking-[-0.03em] text-white">
            3D Print Co.
          </span>
          <span className="mt-1 block text-[8.5px] font-semibold uppercase tracking-[0.26em] text-white/35">
            Made to order · Chennai
          </span>
        </span>
      )}
    </Link>
  );
}

export function AdminMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/40 bg-violet-500/15 text-[11px] font-black text-violet-200">
        AD
      </span>
      <span className="leading-none">
        <span className="block text-sm font-bold text-white">Studio admin</span>
        <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-white/35">
          3D Print Co.
        </span>
      </span>
    </div>
  );
}
