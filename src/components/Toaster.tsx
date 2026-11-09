/**
 * Toaster — renders the toast queue in the bottom-right corner.
 */

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/format";
import { useToast } from "@/lib/toast";

const TONE = {
  info: { icon: Info, className: "border-violet-400/30 text-violet-200" },
  success: { icon: CheckCircle2, className: "border-mint/35 text-mint" },
  warn: { icon: TriangleAlert, className: "border-sun/35 text-sun" },
  error: { icon: XCircle, className: "border-coral/35 text-coral" },
} as const;

export function Toaster() {
  const toasts = useToast((state) => state.toasts);
  const dismiss = useToast((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(340px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const tone = TONE[toast.tone] ?? TONE.info;
        return (
          <div
            key={toast.id}
            className={cn(
              "glass pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5",
              "animate-pop text-[12.5px] text-white/85",
              tone.className,
            )}
          >
            <tone.icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md p-0.5 text-white/40 transition hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
