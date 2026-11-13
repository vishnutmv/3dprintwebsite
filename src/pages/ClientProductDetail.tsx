import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ModelViewer } from "../components/ModelViewer";
import { useStore } from "../lib/store";
import { effectiveProductPrice, promotionState, usePromotionClock } from "../lib/promotions";
function Badge({ text, color = "#fb7185" }: { text: string; color?: string }) {
  if (!text) return null;
  return <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{text}</span>;
}

export function ClientProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const products = useStore((state: { products: import("../lib/types").Product[] }) => state.products);
  const now = usePromotionClock();
  const product = products.find((p) => p.slug === slug);
  const [loading, setLoading] = useState(!product);
  const cart = useStore((state) => state.cart);
  const inCart = cart.find((line) => line.productId === product?.id);

  useEffect(() => {
    if (product) {
      setLoading(false);
      useStore.setState({ message: undefined });
    } else if (!loading) {
      useStore.setState({ message: `No product found for “${slug}”.` });
    }
  }, [product, slug, loading]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-white/60 text-sm">Loading product…</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">Product not found</h2>
        <p className="text-white/50 text-sm mb-4">The page may have moved or the catalogue is still loading.</p>
        <Link to="/shop" className="text-sm text-violet-300 hover:text-white underline">Back to shop</Link>
      </div>
    );
  }

  const qty = inCart ? inCart.qty : 0;
  const stockOk = product.stock > 0;
  const price = effectiveProductPrice(product, now);
  const onOffer = promotionState(product, now) === "active";

  const addToCartAction = useStore.getState().addToCart;

  return (
    <div className="relative pb-20">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <nav className="flex items-center gap-2 text-sm text-white/40 mb-6">
          <Link to="/" className="hover:text-white transition-colors">Home</Link>
          <span className="opacity-40">/</span>
          <Link to="/shop" className="hover:text-white transition-colors">Shop</Link>
          <span className="opacity-40">/</span>
          <span className="capitalize text-white/60">{product.category}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 items-start">
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-violet-950/30 min-h-[420px] flex items-center justify-center">
            <ModelViewer product={product} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge text={product.badge ?? ""} color={product.accent} />
              <span className="text-xs text-white/40">{product.category}</span>
            </div>

            <h1 className="text-3xl font-bold text-white leading-tight mb-2">{product.name}</h1>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-2xl font-semibold text-white">₹{(price / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              {(onOffer ? product.price : product.mrp) && (
                <span className="text-lg text-white/40 line-through">₹{((onOffer ? product.price : product.mrp ?? product.price) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              )}
            </div>

            {product.rating > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-amber-400 text-sm">              {"★".repeat(Math.round(product.rating ?? 0))}</span>
                <span className="text-white/50 text-sm">{product.rating.toFixed(1)} · {product.reviews} review{product.reviews === 1 ? "" : "s"}</span>
              </div>
            )}

            <p className="text-white/70 text-sm leading-relaxed mb-4">{product.description}</p>

            <div className="rounded-xl border border-white/5 p-4 mb-5 text-sm text-white/60 space-y-1">
              {product.material && <div className="flex justify-between"><span className="text-white/40">Material</span><span className="text-white/80">{product.material}</span></div>}
              {product.dimensions && <div className="flex justify-between"><span className="text-white/40">Dimensions</span><span className="text-white/80">{product.dimensions}</span></div>}
              {product.printTime && <div className="flex justify-between"><span className="text-white/40">Print time</span><span className="text-white/80">{product.printTime}</span></div>}
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1">
                <label className="text-xs text-white/40 block mb-1">Quantity</label>
                <div className="flex items-center border border-white/10 rounded-xl overflow-hidden">
                  <button
                    className="px-3 py-2 text-white/60 hover:text-white transition-colors"
                    disabled={!stockOk}
                  >-</button>
                  <span className="flex-1 text-center text-sm text-white font-medium">{qty > 0 ? qty : 1}</span>
                  <button
                    className="px-3 py-2 text-white/60 hover:text-white transition-colors"
                    disabled={!stockOk}
                  >+</button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/40">{stockOk ? `${product.stock} in stock` : "Out of stock"}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                disabled={!stockOk}
                onClick={() => {
                  const qtyNow = qty > 0 ? qty : 1;
                  addToCartAction(product, qtyNow);
                }}
                className="flex-1 rounded-xl py-3 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: stockOk ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(255,255,255,0.06)", color: stockOk ? "#fff" : "text-white/40" }}
              >
                {qty > 0 ? `Update quantity to ${qty}` : "Add to cart"}
              </button>
              <Link to="/cart" className="rounded-xl px-5 py-3 font-semibold text-sm transition-all border border-white/10 text-white/80 hover:text-white" style={{ background: "rgba(255,255,255,0.04)" }}>
                Cart {cart.length ? `(${cart.reduce((s, l) => s + (l.qty ?? 0), 0)})` : ""}
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-xs text-white/40 leading-relaxed">
              <p>Drag to rotate the model above. Scroll to zoom. The live product page can render the customer's uploaded GLB when a model URL is attached.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
