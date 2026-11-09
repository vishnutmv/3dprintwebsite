/**
 * Product detail page — image gallery/video when uploaded, 3D viewer,
 * specifications and add-to-cart. Stock comes from the PHP API.
 */

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Box, Check, Clock, Play, Ruler } from "lucide-react";
import { ModelViewer } from "@/components/ModelViewer";
import { inr } from "@/lib/format";
import { useStore } from "@/lib/store";

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const products = useStore((state) => state.products);
  const loaded = useStore((state) => state.loaded);
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  const [activeImage, setActiveImage] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  const product = products.find((candidate) => candidate.slug === slug);

  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-28 text-center">
        <h1 className="text-[28px]">{loaded ? "That print does not exist." : "Loading product…"}</h1>
        <p className="mt-2 text-sm text-white/50">
          {loaded
            ? "The link may be wrong, or the product was retired from the catalogue."
            : "Fetching the latest catalogue from the studio database."}
        </p>
        {loaded && (
          <Link to="/shop" className="btn-primary mt-6 inline-flex">
            Back to shop
          </Link>
        )}
      </div>
    );
  }

  const inCart = cart.find((item) => item.productId === product.id)?.qty ?? 0;
  const images = product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [];
  const specs: { label: string; value: string }[] = [
    { label: "Size", value: product.dimensions || "—" },
    { label: "Print time", value: product.printTime || "—" },
    { label: "Material", value: product.material || "—" },
    ...Object.entries(product.specifications ?? {})
      .filter(([key]) => !["Material", "Dimensions", "Print time"].includes(key))
      .map(([label, value]) => ({ label, value })),
  ].slice(0, 6);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-24">
      <Link
        to="/shop"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All prints
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        {/* Media / viewer */}
        <div className="glass liquid-edge relative overflow-hidden rounded-[2rem] p-4">
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-60" />
          {showVideo && product.videoUrl ? (
            <video
              src={product.videoUrl}
              controls
              autoPlay
              className="relative h-[420px] w-full rounded-2xl bg-black object-contain"
            />
          ) : images.length > 0 ? (
            <img
              src={images[Math.min(activeImage, images.length - 1)]}
              alt={product.name}
              className="relative h-[420px] w-full rounded-2xl object-cover"
            />
          ) : (
            <ModelViewer product={product} className="relative h-[420px] w-full" />
          )}

          <div className="relative flex items-center justify-between px-2 pb-1 pt-2">
            <span className="chip">
              <Box className="h-3 w-3" />
              {product.modelUrl ? "Uploaded model" : "Studio preview"}
            </span>
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-white/35">
              {showVideo ? "Product video" : images.length > 0 ? "Product photo" : "Drag to rotate · scroll to zoom"}
            </span>
          </div>

          {(images.length > 1 || product.videoUrl || product.modelUrl) && (
            <div className="relative mt-2 flex flex-wrap gap-2 px-2 pb-1">
              {images.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    setShowVideo(false);
                    setActiveImage(index);
                  }}
                  className={`h-14 w-14 overflow-hidden rounded-xl border transition ${
                    !showVideo && activeImage === index
                      ? "border-violet-400"
                      : "border-white/10 opacity-70 hover:opacity-100"
                  }`}
                  aria-label={`Show image ${index + 1}`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideo(true)}
                  className={`grid h-14 w-14 place-items-center rounded-xl border transition ${
                    showVideo ? "border-violet-400 text-violet-200" : "border-white/10 text-white/60"
                  }`}
                  aria-label="Play product video"
                >
                  <Play className="h-5 w-5" />
                </button>
              )}
              {product.modelUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideo(false)}
                  className={`grid h-14 w-14 place-items-center rounded-xl border transition ${
                    !showVideo && images.length === 0
                      ? "border-violet-400 text-violet-200"
                      : "border-white/10 text-white/60"
                  }`}
                  aria-label="View 3D model"
                >
                  <Box className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="glass liquid-edge rounded-[2rem] p-6 md:p-7">
          <span className="eyebrow">{product.category}</span>
          <h1 className="mt-2 text-[clamp(26px,3.6vw,38px)] leading-[1.06]">
            {product.name}
          </h1>

          <div className="mt-2 flex items-center gap-2 text-[12px] text-white/45">
            <span className="text-sun">★</span>
            {product.rating.toFixed(1)}
            <span className="text-white/20">·</span>
            {product.reviews} reviews
            <span className="text-white/20">·</span>
            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
          </div>

          <p className="mt-4 text-[13.5px] leading-relaxed text-white/55">{product.description}</p>

          <div className="mt-5 flex items-end gap-3">
            <span className="num text-[30px] font-bold text-white">{inr(product.price)}</span>
            {product.mrp && (
              <span className="num text-[14px] text-white/30 line-through">{inr(product.mrp)}</span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {specs.map((spec) => {
              const Icon = spec.label === "Size" ? Ruler : spec.label === "Print time" ? Clock : Box;
              return (
                <div key={spec.label} className="glass-soft rounded-2xl p-3">
                  <Icon className="h-3.5 w-3.5 text-violet-300" />
                  <p className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/35">
                    {spec.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-white/75">{spec.value}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => addToCart(product)}
              className="btn-primary flex-1 py-3.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inCart > 0 ? (
                <>
                  <Check className="h-4 w-4" /> Add another ({inCart} in cart)
                </>
              ) : product.stock > 0 ? (
                "Add to cart"
              ) : (
                "Out of stock"
              )}
            </button>
            <Link to="/cart" className="btn-glass px-5">
              View cart
            </Link>
          </div>

          <div className="mt-5 space-y-1.5 border-t border-white/8 pt-4 text-[11.5px] text-white/40">
            <p>Shipping and delivery information is confirmed by the store at checkout.</p>
            <p>For return or replacement questions, contact the store before ordering.</p>
            <p>Any rewards are subject to the published campaign terms and are assigned manually.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
