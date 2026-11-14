/**
 * Site header — sticky bar with nav, greeting, favourites, notifications,
 * cart count and admin entry. Favourites and alerts appear only when a
 * customer is signed in.
 */

import { Link, NavLink, useLocation } from "react-router-dom";
import { Bell, Heart, MessageCircle, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { Logo } from "./Logo";
import { firstName, useAccount } from "@/lib/account";
import { useSocial } from "@/lib/social";
import { cn } from "@/lib/format";
import { useStore } from "@/lib/store";

const nav = [
  { to: "/", label: "Home", end: true },
  { to: "/shop", label: "Shop" },
  { to: "/rewards", label: "Rewards" },
];

export function SiteHeader() {
  // Re-render on navigation so active states stay in sync.
  useLocation();
  const cartCount = useStore((state) => state.cart.reduce((sum, item) => sum + item.qty, 0));
  const whatsappContactUrl = useStore((state) => state.settings.whatsappContactUrl);
  const customer = useAccount((state) => state.customer);
  const favoriteCount = useSocial((state) => state.favorites.length);
  const unreadCount = useSocial((state) => state.unreadCount);

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
            {customer && (
              <Link
                to="/account?tab=orders"
                className="hidden max-w-[150px] items-center gap-2 rounded-xl px-2.5 text-[12px] font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white lg:flex"
                title={customer.name}
              >
                <span className="truncate">Hi, {firstName(customer.name)}</span>
              </Link>
            )}
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
            {customer && (
              <Link
                to="/account?tab=favourites"
                className="relative grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                aria-label={`Favourites, ${favoriteCount} saved`}
              >
                <Heart className="h-4 w-4" />
                {favoriteCount > 0 && (
                  <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9.5px] font-bold text-white">
                    {favoriteCount > 99 ? "99+" : favoriteCount}
                  </span>
                )}
              </Link>
            )}
            {customer && (
              <Link
                to="/account?tab=notifications"
                className="relative grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-violet-400 px-1 text-[9.5px] font-bold text-ink-950">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link
              to="/account"
              className="grid h-9 w-9 place-items-center rounded-xl text-white/60 transition hover:bg-white/[0.06] hover:text-white"
              aria-label={customer ? "Customer profile" : "Sign in"}
            >
              <UserRound className="h-4 w-4" />
            </Link>
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
          <NavLink
            to="/account"
            className={({ isActive }) =>
              cn(
                "rounded-full px-4 py-1.5 text-[12px] font-semibold transition",
                isActive ? "bg-white/[0.08] text-white" : "text-white/55 hover:text-white",
              )
            }
          >
            {customer ? firstName(customer.name) : "Sign in"}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
