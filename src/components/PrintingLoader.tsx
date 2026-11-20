/**
 * 3D-printer waiting state. Purely presentational: show it only while an
 * existing request/payment operation is genuinely in flight.
 */

export function PrintingLoader({
  message = "Preparing your order…",
  detail,
  compact = false,
}: {
  message?: string;
  detail?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={compact ? "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-3" : "print-stage p-4"}
    >
      <div className="flex items-center gap-3">
        <svg
          viewBox="0 0 220 150"
          className={compact ? "h-16 w-24 shrink-0" : "h-40 w-full max-w-[280px] shrink-0"}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="print-object-fill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#8fbe00" />
              <stop offset="0.55" stopColor="#ffd814" />
              <stop offset="1" stopColor="#e6ff8a" />
            </linearGradient>
          </defs>

          {/* frame */}
          <rect x="18" y="16" width="184" height="118" rx="10" fill="none" stroke="#394035" strokeWidth="3" />
          <path d="M18 42h184" stroke="#394035" strokeWidth="2" />
          <path d="M42 42v92M178 42v92" stroke="#2b312a" strokeWidth="2" strokeDasharray="4 5" />

          {/* build plate */}
          <rect x="52" y="112" width="116" height="8" rx="4" fill="#2f362d" />
          <rect x="64" y="108" width="92" height="4" rx="2" fill="#20261f" />

          {/* object */}
          <g className="print-object" style={{ transformOrigin: "110px 108px" }}>
            <path
              d="M110 48c16 0 27 9 27 21v13c0 12-11 21-27 21s-27-9-27-21V69c0-12 11-21 27-21Z"
              fill="url(#print-object-fill)"
              opacity="0.95"
            />
            <path
              d="M85 84c5 10 14 15 25 15s20-5 25-15"
              fill="none"
              stroke="#111311"
              strokeWidth="1.5"
              opacity="0.25"
            />
          </g>

          {/* scan line */}
          <line
            className="print-scan"
            x1="80"
            y1="54"
            x2="140"
            y2="54"
            stroke="#ffd814"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* print head + gantry */}
          <g className="print-head">
            <rect x="96" y="42" width="28" height="12" rx="3" fill="#4b5346" />
            <rect x="104" y="54" width="12" height="6" rx="2" fill="#ffd814" />
            <path d="M104 60 110 68 116 60Z" fill="#8fbe00" />
          </g>

          {/* status light */}
          <circle cx="186" cy="29" r="4" fill="#ffd814">
            <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </svg>

        <div className={compact ? "min-w-0" : "min-w-0 flex-1"}>
          <p className="text-[12.5px] font-semibold text-[color:var(--heading)]">{message}</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-[color:var(--muted)]">
            {detail ?? "Please keep this page open while the studio confirms your order."}
          </p>
          <div className="print-progress-track mt-2.5 max-w-[240px]">
            <div className="print-progress-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}
