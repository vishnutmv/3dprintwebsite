import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { StorePromos } from "@/components/StorePromos";
import { EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/format";
import { effectiveProductPrice, usePromotionClock } from "@/lib/promotions";

const priceBands = [
  { id: "all", label: "Any price" },
  { id: "under1000", label: "Under ₹1,000" },
  { id: "1000to2000", label: "₹1,000 – ₹2,000" },
  { id: "over2000", label: "₹2,000+" },
];

const sorts = [
  { id: "featured", label: "Featured" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated" },
];

export function Shop() {
  const products = useStore((state) => state.products);
  const now = usePromotionClock();
  const [params, setParams] = useSearchParams();
  const activeCategory = params.get("category") ?? "All";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [band, setBand] = useState("all");
  const [sort, setSort] = useState("featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The header search navigates to /shop?q=… while Shop may already be mounted.
  useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.category, (map.get(product.category) ?? 0) + 1);
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    let list = products.filter((product) => {
      if (activeCategory !== "All" && product.category !== activeCategory) return false;
      if (query && !`${product.name} ${product.category} ${product.material}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      const rupees = effectiveProductPrice(product, now) / 100;
      if (band === "under1000" && rupees >= 1000) return false;
      if (band === "1000to2000" && (rupees < 1000 || rupees > 2000)) return false;
      if (band === "over2000" && rupees <= 2000) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return effectiveProductPrice(a, now) - effectiveProductPrice(b, now);
      if (sort === "price-desc") return effectiveProductPrice(b, now) - effectiveProductPrice(a, now);
      if (sort === "rating") return b.rating - a.rating;
      return Number(Boolean(b.badge)) - Number(Boolean(a.badge));
    });

    return list;
  }, [products, activeCategory, query, band, sort, now]);

  const setCategory = (category: string) => {
    const next = new URLSearchParams(params);
    if (category === "All") next.delete("category");
    else next.set("category", category);
    setParams(next, { replace: true });
  };

  const reset = () => {
    setQuery("");
    setBand("all");
    setSort("featured");
    setFiltersOpen(false);
    setParams({}, { replace: true });
  };

  const hasFilters = Boolean(query) || band !== "all" || activeCategory !== "All";

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-24 md:pt-28">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-[color:var(--faint)]">
        <Link to="/" className="hover:text-[color:var(--text)]">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[color:var(--text)]">Shop</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]">
            The catalogue
          </p>
          <h1 className="mt-1.5 text-[clamp(26px,4vw,38px)]">Shop 3D prints</h1>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[color:var(--muted)]">
            Explore our curated collection of high-quality 3D-printed products, made to order.
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 text-[11.5px] font-semibold text-[color:var(--muted)]">
          {filtered.length} {filtered.length === 1 ? "product" : "products"}
        </span>
      </div>

      <StorePromos />

      <div className="mt-6 grid gap-5 lg:grid-cols-[236px_1fr]">
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--heading)] lg:cursor-default"
                aria-expanded={filtersOpen}
                aria-controls="shop-filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-[color:var(--accent)]" /> Filters
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform lg:hidden", filtersOpen && "rotate-180")}
                />
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-[10.5px] font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <div
              id="shop-filters"
              className={cn(filtersOpen ? "block" : "hidden", "lg:block")}
            >
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--faint)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products…"
                className="field h-10 pl-9 text-[12px]"
                aria-label="Search products"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[color:var(--faint)] hover:text-[color:var(--text)]"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="mt-5">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--faint)]">
                Category
              </p>
              <div className="mt-2 grid gap-0.5">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategory(category)}
                    aria-pressed={activeCategory === category}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12px] transition",
                      activeCategory === category
                        ? "bg-[color:var(--surface-deep)] font-semibold text-[color:var(--heading)]"
                        : "text-[color:var(--muted)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text)]",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          activeCategory === category ? "bg-[color:var(--accent)]" : "bg-[color:var(--border-strong)]",
                        )}
                      />
                      {category}
                    </span>
                    <span className="num text-[10px] text-[color:var(--faint)]">
                      {category === "All" ? products.length : counts.get(category) ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-[color:var(--border-soft)] pt-4">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--faint)]">
                Price
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {priceBands.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBand(option.id)}
                    aria-pressed={band === option.id}
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-[10.5px] font-semibold transition",
                      band === option.id
                        ? "border-transparent bg-[#c6ff00] text-[#111311]"
                        : "border-[color:var(--border)] text-[color:var(--muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            </div>
          </div>

          <div className="mt-3 hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 lg:block">
            <p className="text-[11px] font-semibold text-[color:var(--heading)]">Need something unique?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--muted)]">
              Send the studio a reference and ask about a made-to-order print.
            </p>
            <Link
              to="/rewards"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--accent)] hover:underline"
            >
              See current rewards →
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] text-[color:var(--muted)]">
              Showing <span className="font-semibold text-[color:var(--text)]">{filtered.length}</span> of{" "}
              {products.length}
              {activeCategory !== "All" && (
                <>
                  {" "}in <span className="font-semibold text-[color:var(--text)]">{activeCategory}</span>
                </>
              )}
            </p>
            <label className="flex items-center gap-2 text-[11px] text-[color:var(--faint)]">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="field h-9 w-auto py-1.5 pr-8 text-[11.5px]"
                aria-label="Sort products"
              >
                {sorts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Nothing matches that yet"
              copy="Try a different category, clear the search, or widen the price band."
              action={
                <button type="button" className="btn-glass mx-auto mt-5" onClick={reset}>
                  Reset filters
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
