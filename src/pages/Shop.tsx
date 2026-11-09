import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { EmptyState, SectionHead } from "@/components/ui";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/format";

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
  const [params, setParams] = useSearchParams();
  const activeCategory = params.get("category") ?? "All";
  const [query, setQuery] = useState("");
  const [band, setBand] = useState("all");
  const [sort, setSort] = useState("featured");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );

  const filtered = useMemo(() => {
    let list = products.filter((product) => {
      if (activeCategory !== "All" && product.category !== activeCategory) return false;
      if (query && !`${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      const rupees = product.price / 100;
      if (band === "under1000" && rupees >= 1000) return false;
      if (band === "1000to2000" && (rupees < 1000 || rupees > 2000)) return false;
      if (band === "over2000" && rupees <= 2000) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return Number(Boolean(b.badge)) - Number(Boolean(a.badge));
    });

    return list;
  }, [products, activeCategory, query, band, sort]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-24">
      <SectionHead
        eyebrow="Shop"
        title="Everything we print"
        copy="Explore the products currently available from the store."
      />

      <div className="glass mb-6 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[190px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search prints, materials, categories…"
              className="field pl-9"
              aria-label="Search products"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-white/30" />
            <select
              value={band}
              onChange={(event) => setBand(event.target.value)}
              className="field w-auto py-2.5"
              aria-label="Filter by price"
            >
              {priceBands.map((option) => (
                <option key={option.id} value={option.id} className="bg-ink-900">
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="field w-auto py-2.5"
              aria-label="Sort products"
            >
              {sorts.map((option) => (
                <option key={option.id} value={option.id} className="bg-ink-900">
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                if (category === "All") next.delete("category");
                else next.set("category", category);
                setParams(next, { replace: true });
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition",
                activeCategory === category
                  ? "border-transparent bg-violet-400 text-ink-950"
                  : "border-white/12 bg-white/[0.04] text-white/60 hover:border-white/25 hover:text-white",
              )}
            >
              {category}
            </button>
          ))}
          <span className="ml-auto self-center text-[11.5px] text-white/35">
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nothing matches that yet"
          copy="Try a different category, clear the search, or widen the price band."
          action={
            <button
              type="button"
              className="btn-glass mx-auto mt-5"
              onClick={() => {
                setQuery("");
                setBand("all");
                setParams({}, { replace: true });
              }}
            >
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
