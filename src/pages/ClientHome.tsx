import { Link } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { useStore } from "../lib/store";

export function ClientHome() {
  const products = useStore((state: { products: import("../lib/types").Product[] }) => state.products) ?? [];
  const featured = products.slice(0, 6);

  return (
    <div className="relative">
      <section className="relative overflow-hidden pb-20 pt-12 md:pt-24">
        <div className="flex max-w-4xl mx-auto px-4" style={{ animation: "fadeUp 0.6s ease both" }}>
          <div className="space-y-4 text-center md:text-left md:ml-12">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wide" style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(255,255,255,0.06)" }}>
              Printed fresh, in small batches
            </span>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.08]" style={{ color: "#f5f3ff" }}>
              Real objects, <br />
              <span style={{ color: "#fb7185" }}>made in Chennai</span>
            </h1>
            <p className="max-w-xl text-white/60 text-base md:text-lg leading-relaxed">
              Browse the current 3D-printed product catalogue and contact the studio about custom projects.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/shop" className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all" style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)", color: "#fff" }}>
                Browse catalogue
              </Link>
              <Link to="/rewards" className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all border border-white/10 text-white/80 hover:text-white">
                Rewards
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle at 30% 30%, rgba(251,113,133,0.5), rgba(139,92,246,0) 70%)" }} />
        <div className="absolute top-10 -right-20 w-72 h-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.4), rgba(251,113,133,0) 70%)" }} />
      </section>

      <section className="relative py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-white">Popular right now</h2>
              <p className="text-white/50 text-sm mt-1">Drag any product to spin it in 3D.</p>
            </div>
            <Link to="/shop" className="hidden sm:inline-flex text-sm text-violet-300 hover:text-white transition-colors">
              View all
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="text-center py-16 text-white/50">
              <p className="text-lg">The shop is empty while we load the catalogue.</p>
              <p className="text-sm mt-2">The admin can add products from the separate admin panel.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      <section className="relative border-t border-white/5 py-14">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold text-white mb-3">Rewards and product features</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            Rewards are published with their own eligibility terms and are assigned manually by the studio.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { title: "Manual rewards", detail: "Assignments follow each campaign's terms.", color: "#8b5cf6" },
              { title: "3D viewer", detail: "Spin each product in your browser.", color: "#34d399" },
              { title: "Product details", detail: "Review available materials and specifications.", color: "#fb7185" },
            ].map((row, i) => (
              <div key={i} className="rounded-2xl p-4 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="w-2 h-2 rounded-full self-start mb-3" style={{ background: row.color, boxShadow: `0 0 12px ${row.color}` }} />
                <h3 className="text-white font-medium text-sm">{row.title}</h3>
                <p className="text-white/40 text-xs mt-1">{row.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
