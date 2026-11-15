import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/format";

function CubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M12 2.6 21 7.6v8.8L12 21.4 3 16.4V7.6l9-5Z" fill="#111311" opacity="0.94" />
      <path d="M3.6 7.9 12 12.6l8.4-4.7M12 12.6v8.2" stroke="#c6ff00" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m7.4 5.2 8.3 4.6v3.4" stroke="#c6ff00" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function Logo({ compact = false, to = "/" }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#c6ff00] shadow-[0_8px_20px_-10px_rgba(198,255,0,.8)] transition-transform duration-300 group-hover:rotate-[-8deg]">
        <CubeMark className="h-6 w-6" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-extrabold tracking-[-0.035em] text-[#f7f8f2]">
            {BRAND.name}
          </span>
          <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.28em] text-[#c6ff00]/75">
            {BRAND.tagline}
          </span>
        </span>
      )}
    </Link>
  );
}

export function AdminMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#c6ff00]">
        <CubeMark className="h-6 w-6" />
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-extrabold tracking-[-0.03em] text-[#f7f8f2]">{BRAND.name}</span>
        <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.24em] text-[#c6ff00]/70">
          Admin studio
        </span>
      </span>
    </div>
  );
}
