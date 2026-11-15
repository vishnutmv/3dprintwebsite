/**
 * Storefront header — charcoal navigation bar with catalogue search,
 * categories, theme switch, account and live cart count.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  ChevronDown,
  Heart,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { BRAND } from "@/lib/brand";
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cartCount = useStore((state) => state.cart.reduce((sum, item) => sum + item.qty, 0));
  const products = useStore((state) => state.products);
  const whatsappContactUrl = useStore((state) => state.settings.whatsappContactUrl);
  const customer = useAccount((state) => state.customer);
  const favoriteCount = useSocial((state) => state.favorites.length);
  const unreadCount = useSocial((state) => state.unreadCount);

  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [query, setQuery] = useState("");
  const categoryRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 8),
    [products],
  );

  useEffect(() => {
    setMenuOpen(false);
    setCategoriesOpen(false);
    setMobileSearch(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!categoriesOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!categoryRef.current?.contains(event.target as Node)) setCategoriesOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCategoriesOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [categoriesOpen]);

  useEffect(() => {
    if (mobileSearch) searchRef.current?.focus();
  }, [mobileSearch]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setMenuOpen(false);
    setMobileSearch(false);
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };

  const customPrint = whatsappContactUrl ? (
    <a
      href={whatsappContactUrl}
      target="_blank"
      rel="noreferrer"
      className="nav-link"
    >
      Custom Print
    </a>
  ) : (
    <Link to="/shop" className="nav-link">
      Custom Print
    </Link>
  );

  return (
    <>
      <header className="site-header fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-[1320px] px-4">
          <div className="flex h-16 items-center gap-3 md:h-[68px]">
            <button
              type="button"
              className="header-icon -ml-1 grid md:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Logo />

            <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                  {item.label}
                </NavLink>
              ))}

              <div className="relative" ref={categoryRef}>
                <button
                  type="button"
                  className="nav-link"
                  onClick={() => setCategoriesOpen((open) => !open)}
                  aria-haspopup="true"
                  aria-expanded={categoriesOpen}
                >
                  Categories
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", categoriesOpen && "rotate-180")}
                  />
                </button>
                {categoriesOpen && (
                  <div className="absolute left-0 top-[calc(100%+10px)] w-60 overflow-hidden rounded-2xl border border-white/10 bg-[#151815] p-2 shadow-2xl">
                    {categories.length === 0 ? (
                      <p className="px-3 py-2 text-[12px] text-[#a9afa4]">Categories load with the catalogue.</p>
                    ) : (
                      categories.map((category) => (
                        <Link
                          key={category}
                          to={`/shop?category=${encodeURIComponent(category)}`}
                          onClick={() => setCategoriesOpen(false)}
                          className="flex items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-medium text-[#d3d6ce] transition hover:bg-white/[0.06] hover:text-white"
                        >
                          {category}
                          <ArrowRight className="h-3.5 w-3.5 text-[#c6ff00]" />
                        </Link>
                      ))
                    )}
                    <Link
                      to="/shop"
                      onClick={() => setCategoriesOpen(false)}
                      className="mt-1 flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-[11.5px] font-semibold text-[#c6ff00] hover:bg-white/[0.05]"
                    >
                      All products <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {customPrint}
            </nav>

            <div className="ml-auto flex items-center gap-0.5">
              <form onSubmit={submitSearch} className="relative hidden lg:block" role="search">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f948b]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search 3D prints…"
                  aria-label="Search products"
                  className="header-search h-9 w-[190px] rounded-xl pl-8.5 pr-3 text-[12px] transition focus:w-[230px]"
                  style={{ paddingLeft: "2.15rem" }}
                />
              </form>

              <button
                type="button"
                className="header-icon grid lg:hidden"
                onClick={() => setMobileSearch((open) => !open)}
                aria-label={mobileSearch ? "Close search" : "Search products"}
                aria-expanded={mobileSearch}
              >
                <Search className="h-[18px] w-[18px]" />
              </button>

              <span className="ml-1 hidden sm:inline-flex">
                <ThemeToggle />
              </span>

              {customer && (
                <Link
                  to="/account?tab=favourites"
                  className="header-icon relative hidden sm:grid"
                  aria-label={`Favourites, ${favoriteCount} saved`}
                >
                  <Heart className="h-[18px] w-[18px]" />
                  {favoriteCount > 0 && (
                    <span className="num absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#c6ff00] px-1 text-[9px] font-bold text-[#111311]">
                      {favoriteCount > 99 ? "99+" : favoriteCount}
                    </span>
                  )}
                </Link>
              )}
              {customer && (
                <Link
                  to="/account?tab=notifications"
                  className="header-icon relative hidden sm:grid"
                  aria-label={`Notifications, ${unreadCount} unread`}
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unreadCount > 0 && (
                    <span className="num absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-[#c6ff00] px-1 text-[9px] font-bold text-[#111311]">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              )}

              <Link
                to="/account"
                className="header-icon grid"
                aria-label={customer ? "Customer profile" : "Sign in"}
                title={customer ? `Hi, ${firstName(customer.name)}` : "Sign in"}
              >
                <UserRound className="h-[18px] w-[18px]" />
              </Link>

              <Link
                to="/cart"
                data-cart-target
                className="header-icon relative grid"
                aria-label={`Cart, ${cartCount} items`}
              >
                <ShoppingBag className="h-[18px] w-[18px]" />
                {cartCount > 0 && (
                  <span className="num absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#c6ff00] px-1 text-[9.5px] font-extrabold text-[#111311]">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>

              <Link
                to="/admin"
                className="header-icon ml-0.5 hidden xl:grid"
                aria-label="Admin panel"
              >
                <ShieldCheck className="h-[18px] w-[18px]" />
              </Link>
            </div>
          </div>

          {mobileSearch && (
            <form onSubmit={submitSearch} className="pb-3 lg:hidden" role="search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8f948b]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search 3D prints, materials…"
                  aria-label="Search products"
                  className="header-search h-11 w-full rounded-xl pl-9 pr-3 text-[13px]"
                  style={{ paddingLeft: "2.35rem" }}
                />
              </div>
            </form>
          )}
        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="nav-drawer-backdrop absolute inset-0"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-navigation"
            className="nav-drawer absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl text-[#c7cbc2] transition hover:bg-white/10 hover:text-white"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                autoFocus
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-7 grid gap-1" aria-label="Mobile main">
              {[{ to: "/", label: "Home" }, ...nav.slice(1)].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-between rounded-xl px-3.5 py-3 text-[14px] font-semibold transition",
                      isActive ? "bg-[#c6ff00] text-[#111311]" : "text-[#d3d6ce] hover:bg-white/[0.06] hover:text-white",
                    )
                  }
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4 opacity-60" />
                </NavLink>
              ))}
              {whatsappContactUrl && (
                <a
                  href={whatsappContactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl px-3.5 py-3 text-[14px] font-semibold text-[#d3d6ce] transition hover:bg-white/[0.06] hover:text-white"
                >
                  Custom Print <MessageCircle className="h-4 w-4 text-[#c6ff00]" />
                </a>
              )}
            </nav>

            {categories.length > 0 && (
              <div className="mt-6">
                <p className="px-1 text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#8b9087]">
                  Shop by category
                </p>
                <div className="mt-2 grid gap-0.5">
                  {categories.map((category) => (
                    <Link
                      key={category}
                      to={`/shop?category=${encodeURIComponent(category)}`}
                      className="flex items-center justify-between rounded-lg px-1 py-2 text-[12.5px] text-[#b9bdb5] hover:text-white"
                    >
                      {category}
                      <ArrowRight className="h-3.5 w-3.5 text-[#5f655b]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto grid gap-2 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between rounded-xl px-1 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b9087]">
                  Appearance
                </span>
                <ThemeToggle />
              </div>
              <Link
                to="/account"
                className="flex items-center gap-2 rounded-xl px-1 py-2.5 text-[13px] font-medium text-[#d3d6ce] hover:text-white"
              >
                <UserRound className="h-4 w-4" /> {customer ? `Hi, ${firstName(customer.name)}` : "Sign in"}
              </Link>
              <Link
                to="/admin"
                className="flex items-center gap-2 rounded-xl px-1 py-2.5 text-[13px] font-medium text-[#d3d6ce] hover:text-white"
              >
                <ShieldCheck className="h-4 w-4" /> Admin panel
              </Link>
              <p className="px-1 pt-1 text-[10px] uppercase tracking-[0.16em] text-[#6f756b]">
                {BRAND.name} · {BRAND.city}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
