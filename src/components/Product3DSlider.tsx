/**
 * Product3DSlider — the homepage "hover to explore" carousel.
 *
 * Each slide shows the product image. On hover (fine pointer) the slide is
 * swapped for a live 3D canvas that fills the whole slide: the model loads
 * behind a full-slide loading screen, then can be spun a full 360° and zoomed.
 * Clicking the model opens the product page; the slide also carries an
 * add-to-cart action. Touch devices get a 3D toggle instead of hover.
 */

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Plus,
  Rotate3d,
  ShoppingBag,
} from "lucide-react";
import { useModelProbe } from "./ModelViewer";
import { flyToCart } from "@/lib/cart-fly";
import { inr } from "@/lib/format";
import { effectiveProductPrice, promotionState, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import type { Product } from "@/lib/types";

type BoundaryProps = { children: ReactNode; onFail: () => void };

/** A broken or CORS-blocked GLB must not break the carousel or the page. */
class StageBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("Showcase model failed to load; keeping the product image.", error);
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Re-centres and rescales any GLB so it always fits the slide viewport. */
function FittedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url) as { scene: THREE.Object3D };
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const span = Math.max(size.x, size.y, size.z) || 1;
    clone.position.sub(center);
    const group = new THREE.Group();
    group.add(clone);
    group.scale.setScalar(1.72 / span);
    return group;
  }, [scene]);

  return <primitive object={object} />;
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function LoadingCover({ name }: { name: string }) {
  const progress = useProgress((state) => state.progress);
  const percent = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-hidden bg-[#0b0e0b]/95 backdrop-blur-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,216,20,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,216,20,.08) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(70% 70% at 50% 45%, #000 10%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 45%, #000 10%, transparent 78%)",
        }}
      />
      <div className="relative w-[74%] max-w-[240px] text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[#ffd814]/30 bg-[#ffd814]/10 text-[#ffd814]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ffd814]">
          Loading 3D model
        </p>
        <p className="mt-1 truncate text-[11.5px] text-[#b9bdb5]">{name}</p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#ffd814] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type SlideProps = {
  product: Product;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
};

function ShowcaseSlide({ product, active, onActivate, onDeactivate }: SlideProps) {
  const navigate = useNavigate();
  const addToCart = useStore((state) => state.addToCart);
  const pushToast = useToast((state) => state.push);
  const now = usePromotionClock();
  const price = effectiveProductPrice(product, now);
  const onOffer = promotionState(product, now) === "active";
  const image = product.images?.[0] ?? product.imageUrl;
  const hasModel = Boolean(product.modelUrl);
  const probe = useModelProbe(active && hasModel ? product.modelUrl : undefined);
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const pressRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  // Every entry into 3D starts from a blank loading state.
  useEffect(() => {
    if (!active) {
      setModelReady(false);
      setModelFailed(false);
    }
  }, [active]);

  const markReady = useCallback(() => setModelReady(true), []);
  const markFailed = useCallback(() => setModelFailed(true), []);

  const add = () => {
    if (product.stock <= 0) return;
    addToCart(product);
    flyToCart(mediaRef.current, image);
    pushToast(`${product.name} added to cart`, "success");
  };

  const showModel = active && hasModel && probe === "ready" && !modelFailed;
  const openProduct = () => navigate(`/product/${product.slug}`);

  return (
    <article
      data-slide
      className="group relative w-[86%] shrink-0 snap-center overflow-hidden rounded-[22px] border border-white/10 bg-[#12160f] sm:w-[48%] lg:w-[32%]"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onActivate();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onDeactivate();
      }}
    >
      <div ref={mediaRef} className="relative aspect-[4/3.15] w-full overflow-hidden">
        {/* Product image stays behind the canvas so the slide is never empty;
            it fades out once the real model is on screen. */}
        <div
          className={`absolute inset-0 transition-all duration-500 ${
            active && modelReady ? "scale-105 opacity-0" : active ? "scale-105 opacity-40" : ""
          }`}
        >
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div
              className="relative h-full w-full"
              style={{
                background: `radial-gradient(70% 70% at 50% 30%, ${product.accent}55, transparent 70%), linear-gradient(160deg, #1b201a, #0d100d)`,
              }}
            >
              <span
                className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-[26%] transition-transform duration-700 group-hover:scale-105"
                style={{
                  background: `linear-gradient(145deg, ${product.accent}, ${product.accent}66)`,
                  boxShadow: `inset 0 2px 0 rgba(255,255,255,.35), 0 30px 60px -30px ${product.accent}`,
                }}
                aria-hidden="true"
              />
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0e0b] via-[#0b0e0b]/10 to-transparent" />

        {showModel && (
          <div
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            onPointerDown={(event) => {
              pressRef.current = { x: event.clientX, y: event.clientY, moved: false };
            }}
            onPointerMove={(event) => {
              const press = pressRef.current;
              if (!press) return;
              if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press.moved = true;
            }}
            onPointerUp={() => {
              const press = pressRef.current;
              pressRef.current = null;
              // A click, not a drag: open the product page.
              if (press && !press.moved) openProduct();
            }}
          >
            <StageBoundary onFail={markFailed}>
              <Canvas
                camera={{ position: [0, 0.35, 3.2], fov: 38 }}
                dpr={[1, 1.75]}
                gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
              >
                <ambientLight intensity={0.85} />
                <directionalLight position={[4, 6, 5]} intensity={1.7} />
                <directionalLight position={[-4, -2, -3]} intensity={0.5} />
                <Suspense fallback={null}>
                  <FittedModel url={product.modelUrl as string} />
                  <ReadySignal onReady={markReady} />
                </Suspense>
                <OrbitControls
                  makeDefault
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.12}
                  rotateSpeed={0.85}
                  zoomSpeed={0.7}
                  minDistance={2}
                  maxDistance={5.5}
                  autoRotate
                  autoRotateSpeed={0.9}
                />
              </Canvas>
            </StageBoundary>
          </div>
        )}

        {active && hasModel && !modelReady && !modelFailed && <LoadingCover name={product.name} />}

        {(!active || !hasModel) && (
          <Link
            to={`/product/${product.slug}`}
            className="absolute inset-0 z-10"
            aria-label={`View ${product.name}`}
          />
        )}

        {/* Top chips */}
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex flex-wrap gap-1.5">
          {onOffer && (
            <span className="rounded-full bg-[#ffd814] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#111311]">
              Offer
            </span>
          )}
          {product.badge && (
            <span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#f2f4ee] backdrop-blur">
              {product.badge}
            </span>
          )}
          {hasModel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#ffd814]/35 bg-[#ffd814]/12 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#ffe98a] backdrop-blur">
              <Rotate3d className="h-3 w-3" /> 360°
            </span>
          )}
        </div>

        {/* Mobile 3D toggle: no hover on touch, so expose an explicit control. */}
        {hasModel && !active && (
          <button
            type="button"
            onClick={onActivate}
            className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-[#ffd814]/40 bg-[#0b0e0b]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#ffe98a] backdrop-blur sm:hidden"
          >
            <Maximize2 className="h-3 w-3" /> Load 3D
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDeactivate();
            }}
            className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#0b0e0b]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#f2f4ee] backdrop-blur sm:hidden"
          >
            Close 3D
          </button>
        )}

        {active && hasModel && modelReady && (
          <p className="pointer-events-none absolute bottom-3 left-3 z-30 hidden rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[10px] font-medium text-[#e8ebe3] backdrop-blur sm:block">
            Drag to rotate · Scroll to zoom · Click to open
          </p>
        )}
        {active && modelFailed && (
          <p className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[10px] font-medium text-[#e8ebe3] backdrop-blur">
            3D preview unavailable — use the product page
          </p>
        )}
      </div>

      <div className="relative z-30 flex items-center gap-2 border-t border-white/10 bg-[#0f130f] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.16em] text-[#8f948b]">
            {product.category}
          </p>
          <Link
            to={`/product/${product.slug}`}
            className="mt-0.5 block truncate text-[13.5px] font-semibold text-[#f7f8f2] hover:text-[#ffd814]"
          >
            {product.name}
          </Link>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="num text-[13px] font-bold text-[#f7f8f2]">{inr(price)}</span>
            {(onOffer ? product.price : product.mrp) && (
              <span className="num text-[10px] text-[#8f948b] line-through">
                {inr(onOffer ? product.price : product.mrp ?? product.price)}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={product.stock <= 0}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ffd814] text-[#111311] transition hover:bg-[#ffe98a] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Add ${product.name} to cart`}
          title="Add to cart"
        >
          {product.stock > 0 ? <Plus className="h-4 w-4" strokeWidth={2.6} /> : <ShoppingBag className="h-4 w-4" />}
        </button>
      </div>
    </article>
  );
}

export function Product3DSlider({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });
  const hoverTimer = useRef<number | null>(null);
  const lastWheel = useRef(0);

  // Dwell briefly before mounting a WebGL canvas so sweeping the mouse across
  // the carousel does not start (or trap) a 3D session.
  const activate = useCallback((index: number) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      // The pointer sat still through a page scroll: the visitor is browsing,
      // not exploring the model, so leave the slide as an image.
      if (Date.now() - lastWheel.current < 400) return;
      setActiveIndex(index);
    }, 160);
  }, []);

  const deactivate = useCallback((index: number) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setActiveIndex((current) => (current === index ? null : current));
  }, []);

  useEffect(() => () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>("[data-slide]");
    if (!slide) return;
    const step = slide.offsetWidth + 16;
    setPage(Math.round(track.scrollLeft / step));
    setEdges({
      start: track.scrollLeft <= 4,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    track.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      track.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, products.length]);

  const scrollBySlide = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>("[data-slide]");
    const step = slide ? slide.offsetWidth + 16 : track.clientWidth;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const goTo = (index: number) => {
    const track = trackRef.current;
    const slide = track?.querySelector<HTMLElement>("[data-slide]");
    if (!track || !slide) return;
    track.scrollTo({ left: index * (slide.offsetWidth + 16), behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-lg border border-white/10 bg-[linear-gradient(150deg,#1a2430_0%,#0f1418_62%)] px-4 pb-5 pt-6 text-[#f5f5f0] sm:px-6 sm:pb-6 sm:pt-7 md:px-8">
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[#ffd814]/10 blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd814]/25 bg-[#ffd814]/10 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#ffe98a]">
            <Rotate3d className="h-3 w-3" /> Live 3D showcase
          </span>
          <h2 className="mt-2.5 text-[clamp(22px,3.2vw,32px)] text-[#f7f8f2]">
            Featured prints, <span className="text-[#ffd814]">in 360°</span>
          </h2>
          <p className="mt-1 max-w-[440px] text-[12px] leading-relaxed text-[#a9afa4]">
            Hover a print to load its 3D model in place. Drag to spin it, scroll or pinch to
            zoom, then click it to open the product page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/shop"
            className="hidden items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-[11.5px] font-semibold text-[#e8ebe3] transition hover:border-[#ffd814]/50 hover:text-white sm:inline-flex"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => scrollBySlide(-1)}
            disabled={edges.start}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-[#e8ebe3] transition hover:border-[#ffd814]/50 hover:bg-white/5 disabled:opacity-30"
            aria-label="Previous products"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBySlide(1)}
            disabled={edges.end}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-[#e8ebe3] transition hover:border-[#ffd814]/50 hover:bg-white/5 disabled:opacity-30"
            aria-label="Next products"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar relative mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1"
        role="list"
        aria-label="Featured products"
        onWheelCapture={() => {
          lastWheel.current = Date.now();
          if (activeIndex !== null) setActiveIndex(null);
        }}
      >
        {products.map((product, index) => (
          <ShowcaseSlide
            key={product.id}
            product={product}
            active={activeIndex === index}
            onActivate={() => activate(index)}
            onDeactivate={() => deactivate(index)}
          />
        ))}
      </div>

      {products.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {products.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Go to ${product.name}`}
                aria-current={page === index}
                className={`h-1.5 rounded-full transition-all ${
                  page === index ? "w-6 bg-[#ffd814]" : "w-1.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#ffd814] sm:hidden"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
