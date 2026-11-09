import { useEffect, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../lib/store";
import type { Product } from "../lib/types";

const CATEGORIES = ["All", "Miniatures", "Desk gear", "Prototypes", "Accessories"];
const PRICE_BANDS = [
  { label: "Any price", min: 0 },
  { label: "Under ₹500", min: 0, max: 500 },
  { label: "₹500–₹1,500", min: 500, max: 1500 },
  { label: "₹1,500–₹4,000", min: 1500, max: 4000 },
  { label: "Above ₹4,000", min: 4000 },
];

const SORTS = [
  { label: "Newest first", value: "newest" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
  { label: "Top rated", value: "rating" },
];

export function ClientShop() {
  const products = useStore((state: { products: Product[] }) => state.products);
  const loaded = useStore((state: { loaded: boolean }) => state.loaded);
  const [messageState, setMessageState] = useState("");
  const [category, setCategory] = useState("All");
  const [priceBand, setPriceBand] = useState(PRICE_BANDS[0]);
  const [sort, setSort] = useState("newest");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (loaded) return;
    useStore.getState().fetchProducts().catch((err: unknown) => setMessageState(err instanceof Error ? err.message : "Could not load products."));
  }, [loaded]);

  useEffect(() => {
    useStore.setState({ message: undefined });
  }, []);

  let filtered = products;
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (category !== "All") {
    filtered = filtered.filter((p) => (p.category === category || p.category === category.replace(/^\w/, (c) => c.toUpperCase())));
  }
  if (priceBand.min !== undefined) {
    filtered = filtered.filter((p) => p.price >= priceBand.min! && (!priceBand.max || p.price <= priceBand.max!));
  }
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return 0;
  });

  const status = loaded ? undefined : messageState || "Loading the catalogue…";

  return (
    <div className="relative pb-20">
      <div className="max-w-6xl mx-auto px-4 pt-12">
        <h1 className="text-3xl font-bold text-white mb-2">Shop</h1>
        <p className="text-white/50 text-sm mb-8">Every product ships from Chennai and can be rotated in 3D on its page.</p>

        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, categories…"
            className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 border border-white/10 bg-white/5 backdrop-blur focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={() => setSearch("")}
            className="rounded-xl px-4 py-2.5 text-sm text-white/60 hover:text-white transition-colors border border-white/10"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            Clear
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
          <aside className="space-y-2">
            <div className="rounded-xl border border-white/5 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Category</h3>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="block w-full text-left text-sm rounded-lg px-3 py-2 transition-colors"
                    style={{
                      background: category === cat ? "rgba(139,92,246,0.15)" : "transparent",
                      color: category === cat ? "#c4b5fd" : "text-white/70",
                      border: category === cat ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Price</h3>
              <div className="space-y-1">
                {PRICE_BANDS.map((band) => (
                  <button
                    key={band.label}
                    onClick={() => setPriceBand(band)}
                    className="block w-full text-left text-sm rounded-lg px-3 py-2 transition-colors"
                    style={{
                      background: priceBand === band ? "rgba(139,92,246,0.15)" : "transparent",
                      color: priceBand === band ? "#c4b5fd" : "text-white/70",
                      border: priceBand === band ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                    }}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Sort</h3>
              <div className="space-y-1">
                {SORTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSort(s.value)}
                    className="block w-full text-left text-sm rounded-lg px-3 py-2 transition-colors"
                    style={{
                      background: sort === s.value ? "rgba(139,92,246,0.15)" : "transparent",
                      color: sort === s.value ? "#c4b5fd" : "text-white/70",
                      border: sort === s.value ? "1px solid rgba(139,92,246,0.25)" : "1px solid transparent",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            {status ? (
              <div className="rounded-xl border border-white/10 p-6 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-white/70 text-sm">{status}</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-6 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
                <p className="text-white/60">No products match those filters.</p>
                <button onClick={() => { setCategory("All"); setPriceBand(PRICE_BANDS[0]); setSearch(""); }} className="mt-3 text-sm text-violet-300 hover:text-white transition-colors">
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {sorted.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
