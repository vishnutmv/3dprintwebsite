/**
 * Site header — sticky glass bar with nav, cart count and admin entry.
 * The admin panel lives at /admin and is deliberately not linked in the main nav
 * beyond this small utility link.
 */

import { Link, NavLink, useLocation } from "react-router-dom";
import { MessageCircle, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { rememberedCustomerCode } from "@/lib/customer";
import { cn } from "@/lib/format";
import { useStore } from "@/lib/store";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/shop", label: "Shop" },
  { to: "/rewards", label: "Rewards" },
];

export function SiteHeader() {
  // Re-render on navigation so the profile entry appears after a sign-in.
  useLocation();
  const cartCount = useStore((state) => state.cart.reduce((sum, item) => sum + item.qty, 0));
  const whatsappContactUrl = useStore((state) => state.settings.whatsappContactUrl);
  // The profile entry unlocks after a first order, when this browser has a
  // customer code. New visitors still reach it from the footer or after checkout.
  const hasProfile = Boolean(rememberedCustomerCode());

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-ink-950/70 backdrop-blur-xl">
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-3.5 py-2 text-[12.5px] font-medium transition",
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/55 hover:bg-white/[0.05] hover:text-white",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {whatsappContactUrl && (
              <a
                href={whatsappContactUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-medium text-mint transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Enquire on WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Enquire</span>
              </a>
            )}
            {hasProfile && (
              <Link
                to="/account"
                className="grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Customer profile"
              >
                <UserRound className="h-4 w-4" />
              </Link>
            )}
            <Link
              to="/cart"
              className="relative grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              aria-label={`Cart, ${cartCount} items`}
            >
              <ShoppingBag className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-400 px-1 text-[9.5px] font-bold text-ink-950">
                  {cartCount}
                </span>
              )}
            </Link>

            <Link
              to="/admin"
              className="grid h-9 w-9 place-items-center rounded-xl text-white/45 transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Admin panel"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <nav className="flex items-center justify-center gap-2 border-t border-white/10 py-2 md:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-1.5 text-[12px] font-semibold transition",
                  isActive ? "bg-white/[0.08] text-white" : "text-white/55 hover:text-white",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
