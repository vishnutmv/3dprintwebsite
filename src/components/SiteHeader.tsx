/**
 * Storefront header — Amazon-style two-tier chrome.
 *   Top row:   logo, delivery location, search, theme, account, orders, cart.
 *   Sub nav:   "All" category flyout plus the main storefront links.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  Heart,
  LayoutGrid,
  MapPin,
  Menu,
  Package,
  Search,
  ShoppingCart,
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
  const settings = useStore((state) => state.settings);
  const whatsappContactUrl = useStore((state) => state.settings.whatsappContactUrl);
  const customer = useAccount((state) => state.customer);
  const favoriteCount = useSocial((state) => state.favorites.length);
  const unreadCount = useSocial((state) => state.unreadCount);

  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categoryRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 12),
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
    const next = new URLSearchParams();
    if (term) next.set("q", term);
    if (category) next.set("category", category);
    setMenuOpen(false);
    setMobileSearch(false);
    navigate(next.toString() ? `/shop?${next.toString()}` : "/shop");
  };

  const customPrint = whatsappContactUrl ? (
    <a href={whatsappContactUrl} target="_blank" rel="noreferrer" className="nav-link">
      Custom Print
    </a>
  ) : (
    <Link to="/shop" className="nav-link">
      Custom Print
    </Link>
  );

  return (
    <>
      <header className="site-header sticky top-0 z-50">
        {/* ---------------- top row ---------------- */}
        <div className="header-top">
          <div className="mx-auto flex h-[60px] max-w-[1500px] items-center gap-1 px-2 sm:gap-2 sm:px-3">
            <button
              type="button"
              className="header-hit inline-flex p-2.5 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Logo />

            <Link to="/account" className="header-hit ml-1 hidden items-end gap-1.5 md:inline-flex">
              <MapPin className="mb-0.5 h-4 w-4 text-[#febd69]" />
              <span>
                <span className="header-hit-line1">Deliver to</span>
                <span className="header-hit-line2">{settings.city || BRAND.city}</span>
              </span>
            </Link>

            <form onSubmit={submitSearch} className="ml-2 hidden min-w-0 flex-1 md:flex" role="search">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Search category"
                className="header-search-select hidden h-10 max-w-[160px] shrink-0 px-2 text-[12px] lg:block"
              >
                <option value="">All</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Zencmart for 3D prints, materials…"
                aria-label="Search products"
                className="header-search h-10 min-w-0 flex-1 px-3 text-[14px]"
              />
              <button type="submit" className="header-search-btn" aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
            </form>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                className="header-hit inline-flex p-2 md:hidden"
                onClick={() => setMobileSearch((open) => !open)}
                aria-label={mobileSearch ? "Close search" : "Search products"}
                aria-expanded={mobileSearch}
              >
                <Search className="h-5 w-5" />
              </button>

              <span className="hidden sm:inline-flex">
                <ThemeToggle />
              </span>

              <div className="group relative hidden lg:block">
                <Link to="/account" className="header-hit inline-flex">
                  <span>
                    <span className="header-hit-line1">
                      {customer ? `Hello, ${firstName(customer.name)}` : "Hello, sign in"}
                    </span>
                    <span className="header-hit-line2">
                      Account &amp; Lists <ChevronDown className="h-3 w-3 text-[#ccc]" />
                    </span>
                  </span>
                </Link>
                <div className="header-flyout absolute right-0 top-full z-50 hidden w-60 py-2 group-hover:block group-focus-within:block">
                  <Link to="/account" className="block px-4 py-1.5 text-[13px]">
                    Your account
                  </Link>
                  <Link to="/account?tab=orders" className="block px-4 py-1.5 text-[13px]">
                    Your orders
                  </Link>
                  <Link to="/account?tab=favourites" className="block px-4 py-1.5 text-[13px]">
                    Your favourites {favoriteCount > 0 && `(${favoriteCount})`}
                  </Link>
                  <Link to="/account?tab=notifications" className="block px-4 py-1.5 text-[13px]">
                    Notifications {unreadCount > 0 && `(${unreadCount})`}
                  </Link>
                  <div className="my-1 border-t border-[color:var(--border-soft)]" />
                  <Link to="/rewards" className="block px-4 py-1.5 text-[13px]">
                    Rewards &amp; offers
                  </Link>
                </div>
              </div>

              <Link to="/account?tab=orders" className="header-hit hidden xl:inline-flex">
                <span>
                  <span className="header-hit-line1">Returns</span>
                  <span className="header-hit-line2">&amp; Orders</span>
                </span>
              </Link>

              <Link
                to="/cart"
                data-cart-target
                className="header-hit inline-flex items-end gap-1 px-2 py-2"
                aria-label={`Cart, ${cartCount} items`}
              >
                <span className="relative">
                  <ShoppingCart className="h-[26px] w-[26px]" strokeWidth={1.9} />
                  <span className="header-cart-count num">{cartCount > 99 ? "99+" : cartCount}</span>
                </span>
                <span className="hidden pb-0.5 text-[13px] font-bold sm:inline">Cart</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile search row */}
        {mobileSearch && (
          <div className="header-top px-3 pb-2.5 md:hidden">
            <form onSubmit={submitSearch} className="flex" role="search">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Zencmart for 3D prints…"
                aria-label="Search products"
                className="header-search h-10 min-w-0 flex-1 px-3 text-[14px]"
              />
              <button type="submit" className="header-search-btn" aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
            </form>
          </div>
        )}

        {/* ---------------- sub nav ---------------- */}
        <div className="header-subnav">
          <div className="mx-auto flex h-[40px] max-w-[1500px] items-center gap-0.5 px-2 sm:px-3">
            <div className="relative" ref={categoryRef}>
              <button
                type="button"
                className="nav-link font-bold"
                onClick={() => setCategoriesOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={categoriesOpen}
              >
                <Menu className="h-4 w-4" />
                All
              </button>
              {categoriesOpen && (
                <div className="header-flyout absolute left-0 top-[calc(100%+4px)] z-50 w-[280px] max-h-[70vh] overflow-y-auto py-2">
                  <p className="px-4 pb-1 text-[13px] font-bold text-[color:var(--heading)]">Shop by category</p>
                  {categories.length === 0 ? (
                    <p className="px-4 py-2 text-[12px] text-[color:var(--muted)]">
                      Categories load with the catalogue.
                    </p>
                  ) : (
                    categories.map((item) => (
                      <Link
                        key={item}
                        to={`/shop?category=${encodeURIComponent(item)}`}
                        onClick={() => setCategoriesOpen(false)}
                        className="block px-4 py-1.5 text-[13px]"
                      >
                        {item}
                      </Link>
                    ))
                  )}
                  <div className="my-1 border-t border-[color:var(--border-soft)]" />
                  <Link
                    to="/shop"
                    onClick={() => setCategoriesOpen(false)}
                    className="flex items-center gap-2 px-4 py-1.5 text-[13px] font-semibold"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> All products
                  </Link>
                </div>
              )}
            </div>

            <nav className="flex min-w-0 items-center gap-0.5 overflow-hidden" aria-label="Main">
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                  {item.label}
                </NavLink>
              ))}
              <Link to="/shop" className="nav-link hidden sm:inline-flex">
                Today's Deals
              </Link>
              <span className="hidden sm:flex">{customPrint}</span>
            </nav>

            <span className="ml-auto hidden truncate pl-3 text-[12px] text-[#d6d9d9] lg:block">
              Free delivery across Tamil Nadu on orders over{" "}
              <span className="num font-semibold text-[#ffffff]">
                ₹{Math.round(settings.freeShippingOver / 100).toLocaleString("en-IN")}
              </span>
            </span>
          </div>
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
            className="nav-drawer absolute inset-y-0 left-0 flex w-[86%] max-w-[340px] flex-col overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <div className="flex items-center justify-between bg-[#232f3e] px-4 py-3.5 text-[#ffffff]">
              <Link to="/account" className="flex items-center gap-2 text-[15px] font-bold">
                <UserRound className="h-5 w-5" />
                {customer ? `Hello, ${firstName(customer.name)}` : "Hello, sign in"}
              </Link>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded text-[#ffffff] transition hover:bg-white/10"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                autoFocus
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3">
              <p className="drawer-heading">Shop</p>
              <nav className="grid" aria-label="Mobile main">
                {nav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) => cn("drawer-link", isActive && "bg-[#f3f3f3] font-bold")}
                  >
                    {item.label}
                  </NavLink>
                ))}
                <Link to="/shop" className="drawer-link">
                  Today's Deals
                </Link>
                {whatsappContactUrl && (
                  <a href={whatsappContactUrl} target="_blank" rel="noreferrer" className="drawer-link">
                    Custom Print
                  </a>
                )}
              </nav>

              {categories.length > 0 && (
                <div className="mt-4 border-t border-[#e3e6e6] pt-3">
                  <p className="drawer-heading">Shop by category</p>
                  <div className="grid">
                    {categories.map((item) => (
                      <Link
                        key={item}
                        to={`/shop?category=${encodeURIComponent(item)}`}
                        className="drawer-link text-[13px]"
                      >
                        {item}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-[#e3e6e6] pt-3">
                <p className="drawer-heading">Your account</p>
                <div className="grid">
                  <Link to="/account" className="drawer-link text-[13px]">
                    <span className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" /> Profile
                    </span>
                  </Link>
                  <Link to="/account?tab=orders" className="drawer-link text-[13px]">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" /> Orders
                    </span>
                  </Link>
                  <Link to="/account?tab=favourites" className="drawer-link text-[13px]">
                    <span className="flex items-center gap-2">
                      <Heart className="h-4 w-4" /> Favourites
                      {favoriteCount > 0 && <span className="num text-[#565959]">({favoriteCount})</span>}
                    </span>
                  </Link>
                  <Link to="/account?tab=notifications" className="drawer-link text-[13px]">
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4" /> Notifications
                      {unreadCount > 0 && <span className="num text-[#565959]">({unreadCount})</span>}
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t border-[#e3e6e6] p-3">
              <div className="flex items-center justify-between px-1 py-2">
                <span className="text-[13px] font-bold text-[#0f1111]">Appearance</span>
                <ThemeToggle />
              </div>
              <Link to="/admin" className="drawer-link text-[13px]">
                Admin panel
              </Link>
              <p className="px-1 pt-2 text-[11px] text-[#565959]">
                {BRAND.name} · {BRAND.city}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
