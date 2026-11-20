import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/format";

function CubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M12 2.6 21 7.6v8.8L12 21.4 3 16.4V7.6l9-5Z" fill="#febd69" />
      <path d="M3.6 7.9 12 12.6l8.4-4.7M12 12.6v8.2" stroke="#131921" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({
  compact = false,
  to = "/",
  onLight = false,
}: {
  compact?: boolean;
  to?: string;
  /** Dark wordmark for light surfaces such as the mobile drawer. */
  onLight?: boolean;
}) {
  return (
    <Link to={to} className="group flex items-end gap-1.5" aria-label={`${BRAND.name} home`}>
      <CubeMark className="h-7 w-7 shrink-0 transition-transform duration-300 group-hover:rotate-[-6deg]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-[21px] font-extrabold tracking-[-0.045em]",
              onLight ? "text-[#0f1111]" : "text-[#ffffff]",
            )}
          >
            {BRAND.name.toLowerCase()}
            <span className="text-[#ff9900]">.</span>
          </span>
          <span
            className={cn(
              "mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.22em]",
              onLight ? "text-[#565959]" : "text-[#febd69]",
            )}
          >
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
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#ffd814]">
        <CubeMark className="h-6 w-6" />
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-extrabold tracking-[-0.03em] text-[#f7f8f2]">{BRAND.name}</span>
        <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.24em] text-[#ffd814]/70">
          Admin studio
        </span>
      </span>
    </div>
  );
}
