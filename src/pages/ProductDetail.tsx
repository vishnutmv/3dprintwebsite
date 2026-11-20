/**
 * Product detail page — image gallery/video when uploaded, 3D viewer,
 * specifications and add-to-cart. Stock comes from the PHP API.
 */

import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Box,
  Check,
  ChevronRight,
  Clock,
  Minus,
  Play,
  Plus,
  Ruler,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { ModelViewer } from "@/components/ModelViewer";
import { ProductReviews } from "@/components/ProductReviews";
import { flyToCart } from "@/lib/cart-fly";
import { inr } from "@/lib/format";
import { effectiveProductPrice, promotionState, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const products = useStore((state) => state.products);
  const loaded = useStore((state) => state.loaded);
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  const pushToast = useToast((state) => state.push);
  const now = usePromotionClock();
  const [activeImage, setActiveImage] = useState(0);
  const [activeMedia, setActiveMedia] = useState<"image" | "video" | "model">("model");
  const [qty, setQty] = useState(1);
  const mediaRef = useRef<HTMLDivElement>(null);

  const product = products.find((candidate) => candidate.slug === slug);

  if (!product) {
    return (
      <div className="mx-auto grid min-h-[100svh] max-w-[1280px] place-items-center px-4">
        <div className="max-w-xl text-center">
          <h1 className="text-[28px]">{loaded ? "That print does not exist." : "Loading product…"}</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
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
      </div>
    );
  }

  const price = effectiveProductPrice(product, now);
  const onOffer = promotionState(product, now) === "active";
  const inCart = cart.find((item) => item.productId === product.id)?.qty ?? 0;
  const images = product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : [];
  const activeMediaView =
    activeMedia === "model" && !product.modelUrl && images.length > 0 ? "image" : activeMedia;
  const specs: { label: string; value: string }[] = [
    { label: "Size", value: product.dimensions || "—" },
    { label: "Print time", value: product.printTime || "—" },
    { label: "Material", value: product.material || "—" },
    ...Object.entries(product.specifications ?? {})
      .filter(([key]) => !["Material", "Dimensions", "Print time"].includes(key))
      .map(([label, value]) => ({ label, value })),
  ].slice(0, 6);

  const add = () => {
    if (product.stock <= 0) return;
    addToCart(product, qty);
    flyToCart(mediaRef.current, product.imageUrl ?? images[0]);
    pushToast(`${product.name} added to cart`, "success");
  };

  const buyNow = () => {
    if (product.stock <= 0) return;
    addToCart(product, qty);
    flyToCart(mediaRef.current, product.imageUrl ?? images[0]);
    navigate("/cart");
  };

  return (
    <div className="mx-auto max-w-[1500px] px-3 pb-28 pt-3 sm:px-4 lg:pb-12">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--faint)]">
        <Link to="/" className="hover:text-[color:var(--text)]">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/shop" className="hover:text-[color:var(--text)]">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          to={`/shop?category=${encodeURIComponent(product.category)}`}
          className="hover:text-[color:var(--text)]"
        >
          {product.category}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[color:var(--text)]">{product.name}</span>
      </nav>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.02fr_0.98fr] lg:items-start">
        {/* Media / viewer */}
        <div className="lg:sticky lg:top-[124px]">
          <div className="overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)]">
            <div
              ref={mediaRef}
              className="relative grid h-[340px] place-items-center overflow-hidden bg-[color:var(--surface-soft)] sm:h-[430px] lg:h-[500px]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_50%_0%,rgba(231,240,243,.7),transparent_65%)]" />
              {activeMediaView === "video" && product.videoUrl ? (
                <video
                  src={product.videoUrl}
                  controls
                  autoPlay
                  className="relative h-full w-full bg-black object-contain"
                />
              ) : activeMediaView === "model" && product.modelUrl ? (
                <ModelViewer product={product} className="relative h-full w-full" />
              ) : images.length > 0 ? (
                <img
                  src={images[Math.min(activeImage, images.length - 1)]}
                  alt={product.name}
                  className="relative h-full w-full object-cover"
                />
              ) : (
                <ModelViewer product={product} className="relative h-full w-full" />
              )}

              <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-[#565959] shadow-sm">
                <Box className="h-3 w-3" />
                {product.modelUrl ? "Uploaded model" : "Studio preview"}
              </span>
            </div>

            {(images.length > 1 || product.videoUrl || product.modelUrl) && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto p-3">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => {
                      setActiveMedia("image");
                      setActiveImage(index);
                    }}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                      activeMediaView === "image" && activeImage === index
                        ? "border-[#ffa41c]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Show image ${index + 1}`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
                {product.videoUrl && (
                  <button
                    type="button"
                    onClick={() => setActiveMedia("video")}
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2 transition ${
                      activeMedia === "video"
                        ? "border-[#ffa41c] bg-[color:var(--surface-deep)] text-[color:var(--heading)]"
                        : "border-transparent bg-[color:var(--surface-soft)] text-[color:var(--muted)]"
                    }`}
                    aria-label="Play product video"
                  >
                    <Play className="h-5 w-5" />
                  </button>
                )}
                {product.modelUrl && (
                  <button
                    type="button"
                    onClick={() => setActiveMedia("model")}
                    className={`grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2 transition ${
                      activeMediaView === "model"
                        ? "border-[#ffa41c] bg-[color:var(--surface-deep)] text-[color:var(--heading)]"
                        : "border-transparent bg-[color:var(--surface-soft)] text-[color:var(--muted)]"
                    }`}
                    aria-label="View 3D model"
                  >
                    <Box className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { icon: ShieldCheck, title: "High detail", copy: "Clean, precise finish" },
              { icon: Box, title: "Durable", copy: "Made for daily use" },
              { icon: Truck, title: "Shipped", copy: "Across India" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-2.5 text-center"
              >
                <item.icon className="mx-auto h-4 w-4 text-[color:var(--accent)]" />
                <p className="mt-1 text-[10px] font-semibold text-[color:var(--heading)]">{item.title}</p>
                <p className="text-[9px] text-[color:var(--faint)]">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="text-[12.5px] font-medium text-[color:var(--accent)]">
            {product.category}
          </p>
          <h1 className="mt-1 text-[clamp(22px,3.2vw,32px)] font-bold leading-[1.15]">{product.name}</h1>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--muted)]">
            <span className="flex items-center gap-1">
              <span className="text-[#b98a12]">★</span>
              <span className="font-semibold text-[color:var(--text)]">{product.rating.toFixed(1)}</span>
              <span className="text-[color:var(--faint)]">({product.reviews} reviews)</span>
            </span>
            <span className="text-[color:var(--border-strong)]">·</span>
            <span className={product.stock > 0 ? "text-[color:var(--accent)]" : "text-[color:var(--coral)]"}>
              {product.stock > 0 ? `In stock · ${product.stock} available` : "Out of stock"}
            </span>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--muted)]">{product.description}</p>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <span className="num text-[32px] font-bold leading-none text-[color:var(--heading)]">{inr(price)}</span>
            {(onOffer ? product.price : product.mrp) && (
              <span className="num text-[13px] text-[color:var(--faint)] line-through">
                {inr(onOffer ? product.price : product.mrp ?? product.price)}
              </span>
            )}
            {onOffer && (
              <span className="rounded-sm bg-[#cc0c39] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
                Deal
              </span>
            )}
          </div>
          {(product.recentSoldCount ?? 0) > 0 && (
            <p className="mt-1.5 text-[11px] font-medium text-[color:var(--accent)]">
              {product.recentSoldCount} purchased in the last 30 days
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--faint)]">Material</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)] bg-[color:var(--surface-soft)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--heading)]">
                <Check className="h-3 w-3" /> {product.material || "Standard"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[color:var(--faint)]">Quantity</p>
                <div className="mt-2 inline-flex items-center gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-1">
                  <button
                    type="button"
                    onClick={() => setQty((current) => Math.max(1, current - 1))}
                    className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--heading)]"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="num w-8 text-center text-[13px] font-semibold">{qty}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQty((current) => Math.min(Math.max(product.stock, 1), current + 1))
                    }
                    className="grid h-8 w-8 place-items-center rounded-lg text-[color:var(--muted)] transition hover:bg-[color:var(--surface)] hover:text-[color:var(--heading)]"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[color:var(--faint)]">
                {inCart > 0 ? `${inCart} already in your cart` : "Added to your cart instantly"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={add}
              className="btn-primary flex-1 py-3.5"
            >
              <ShoppingBag className="h-4 w-4" />
              {inCart > 0 ? "Add another" : "Add to Cart"}
            </button>
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={buyNow}
              className="btn-buy flex-1 py-3.5"
            >
              Buy Now
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {specs.map((spec) => {
              const Icon = spec.label === "Size" ? Ruler : spec.label === "Print time" ? Clock : Box;
              return (
                <div
                  key={spec.label}
                  className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-soft)] px-3 py-2.5"
                >
                  <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[color:var(--faint)]">
                    <Icon className="h-3 w-3 text-[color:var(--accent)]" /> {spec.label}
                  </span>
                  <p className="mt-1 text-[11.5px] leading-snug text-[color:var(--text)]">{spec.value}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-[color:var(--border)] pt-4 text-[11px] leading-relaxed text-[color:var(--muted)]">
            <p>Shipping and delivery information is confirmed by the store at checkout.</p>
            <p>For return or replacement questions, contact the store before ordering.</p>
            <p>Any rewards are subject to the published campaign terms and are assigned manually.</p>
          </div>

          <Link
            to="/shop"
            className="mt-5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to all prints
          </Link>
        </div>
      </div>

      <ProductReviews product={product} />

      {/* Phone checkout bar: keep price and Add to Cart reachable while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[560px] items-center gap-3">
          <div className="min-w-0">
            <p className="num text-[15px] font-bold leading-none text-[color:var(--heading)]">{inr(price)}</p>
            <p className="mt-1 truncate text-[10px] text-[color:var(--faint)]">
              {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
            </p>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={product.stock <= 0}
            className="btn-primary flex-1 py-3"
          >
            <ShoppingBag className="h-4 w-4" />
            {inCart > 0 ? "Add another" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
