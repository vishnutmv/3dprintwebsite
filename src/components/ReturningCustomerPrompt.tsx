/**
 * A quiet welcome-back card for browsers that have ordered before.
 * It never blocks browsing or checkout; customers can dismiss it for a week.
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { ApiError, apiGet } from "@/lib/api";
import { accountPromptDismissed, dismissAccountPrompt, rememberedCustomerCode } from "@/lib/customer";

export function ReturningCustomerPrompt() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!rememberedCustomerCode() || accountPromptDismissed()) return;
    let active = true;
    apiGet<{ customer: { name: string } }>("/api/customer/session")
      .then(() => {
        // Already signed in on this browser; nothing to prompt.
      })
      .catch((error) => {
        if (active && error instanceof ApiError && error.status === 401) setVisible(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Stay out of the account and checkout flows; the prompt is only a nudge.
  const quietRoute = location.pathname === "/account"
    || location.pathname === "/checkout"
    || location.pathname === "/cart"
    || location.pathname.startsWith("/order/");
  if (!visible || quietRoute || accountPromptDismissed()) return null;

  const dismiss = () => {
    dismissAccountPrompt();
    setVisible(false);
  };

  return (
    <aside
      aria-label="Sign in to your account"
      className="fixed bottom-4 right-4 z-40 w-[min(330px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-white p-4 shadow-[0_18px_40px_-18px_rgba(44,43,34,.45)]"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-white/35 transition hover:bg-black/5 hover:text-white"
        aria-label="Dismiss sign-in reminder"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-violet-300">Welcome back</p>
      <p className="mt-1 text-[13.5px] font-semibold text-white">See your orders in one place</p>
      <p className="mt-1 pr-4 text-[11.5px] leading-relaxed text-white/45">
        Sign in with a six-digit WhatsApp code using the number you ordered with. No password needed.
      </p>
      <div className="mt-3 flex gap-2">
        <Link to="/account" onClick={dismiss} className="btn-primary !py-2 !text-[11.5px]">
          <MessageCircle className="h-3.5 w-3.5" /> Sign in
        </Link>
        <button type="button" onClick={dismiss} className="btn-glass !py-2 !text-[11.5px]">
          Not now
        </button>
      </div>
    </aside>
  );
}
