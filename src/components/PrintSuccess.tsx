/**
 * Payment-complete celebration. Render only after the existing server-side
 * verification reports the order as paid — never from a timer or client state
 * alone.
 */

import type { ReactNode } from "react";
import { Check } from "lucide-react";

const confetti = [
  { left: "18%", top: "24%", dx: "-26px", dy: "74px", color: "#c6ff00", delay: "0.55s" },
  { left: "30%", top: "18%", dx: "18px", dy: "66px", color: "#f5f5f0", delay: "0.7s" },
  { left: "58%", top: "20%", dx: "-14px", dy: "88px", color: "#c6ff00", delay: "0.62s" },
  { left: "71%", top: "26%", dx: "28px", dy: "70px", color: "#8fbe00", delay: "0.8s" },
  { left: "83%", top: "32%", dx: "12px", dy: "92px", color: "#f5f5f0", delay: "0.68s" },
  { left: "44%", top: "16%", dx: "-32px", dy: "60px", color: "#d7ff38", delay: "0.75s" },
];

export function PrintSuccess({
  orderNumber,
  action,
  children,
}: {
  orderNumber: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="print-success p-6 text-center md:p-8" aria-labelledby="order-success-title">
      <div className="print-success-scan" aria-hidden="true" />
      {confetti.map((dot, index) => (
        <span
          key={index}
          className="confetti-dot"
          aria-hidden="true"
          style={{
            left: dot.left,
            top: dot.top,
            background: dot.color,
            animationDelay: dot.delay,
            ["--dx" as string]: dot.dx,
            ["--dy" as string]: dot.dy,
          }}
        />
      ))}

      <div className="relative mx-auto flex flex-col items-center">
        <div className="success-check">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>

        <p className="mt-4 text-[9.5px] font-bold uppercase tracking-[0.24em] text-[#c6ff00]">
          Print complete
        </p>
        <h1 id="order-success-title" className="mt-2 text-[clamp(22px,4vw,30px)] text-[#f7f8f2]">
          Your order is successfully placed!
        </h1>
        <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-[#a9afa4]">
          Your next 3D creation is on its way.
        </p>

        <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#8f948b]">Order</span>
          <span className="num text-[13px] font-bold text-[#f7f8f2]">{orderNumber}</span>
        </div>

        {children}

        {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
      </div>
    </section>
  );
}
