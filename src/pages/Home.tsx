/**
 * Home page — Amazon-style storefront landing: promo banner, category cards,
 * horizontal deal/best-seller rails and the studio's 3D showcase.
 */

import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Gift,
  Layers,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Product3DSlider } from "@/components/Product3DSlider";
import { ProductCard } from "@/components/ProductCard";
import { PromotionBanner } from "@/components/PromotionBanner";
import { StorePromos } from "@/components/StorePromos";
import { Testimonials } from "@/components/Testimonials";
import { inr } from "@/lib/format";
import { effectiveProductPrice, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

/** Horizontal product rail with Amazon-style arrow controls. */
function ProductRail({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setEdges({
      start: track.scrollLeft <= 4,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    });
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(220, track.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={trackRef} onScroll={measure} className="amz-rail no-scrollbar -mx-1 px-1">
        {products.map((product) => (
          <div key={product.id} className="w-[178px] sm:w-[196px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      {!edges.start && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          className="rail-arrow absolute -left-2 top-[38%] hidden shadow-md sm:grid"
          aria-label="Scroll products left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          className="rail-arrow absolute -right-2 top-[38%] hidden shadow-md sm:grid"
          aria-label="Scroll products right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Section({
  title,
  to,
  children,
}: {
  title: string;
  to?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="amz-card p-4 sm:p-5">
      <div className="amz-row-head">
        <h2 className="amz-section-title">{title}</h2>
        {to && (
          <Link to={to} className="amz-link shrink-0 text-[13px]">
            See all
          </Link>
        )}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

export function Home() {
  const products = useStore((state) => state.products) ?? [];
  const prizes = useStore((state) => state.prizes) ?? [];
  const loaded = useStore((state) => state.loaded);
  const whatsappContactUrl = useStore((state) => state.settings.whatsappContactUrl);
  const now = usePromotionClock();

  const heroProduct = products.find((product) => product.imageUrl) ?? products[0];
  const openPrizes = prizes.filter((prize) => prize.status === "open");
  const topPrize = openPrizes.reduce((best, prize) => (prize.worth > best ? prize.worth : best), 0);

  const deals = products
    .filter((product) => product.mrp && product.mrp > effectiveProductPrice(product, now))
    .sort((a, b) => {
      const offA = 1 - effectiveProductPrice(a, now) / (a.mrp ?? 1);
      const offB = 1 - effectiveProductPrice(b, now) / (b.mrp ?? 1);
      return offB - offA;
    })
    .slice(0, 10);

  const bestSellers = [...products]
    .sort((a, b) => b.rating * b.reviews - a.rating * a.reviews)
    .slice(0, 10);

  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 8);
  const categoryPreview = (category: string): Product | undefined =>
    products.find((product) => product.category === category && product.imageUrl) ??
    products.find((product) => product.category === category);

  return (
    <div className="pb-10">
      {/* Hero banner */}
      <section className="hero-banner">
        <div className="relative z-10 mx-auto grid max-w-[1500px] items-center gap-6 px-4 pb-24 pt-8 sm:px-6 md:min-h-[360px] md:pb-28 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
          <div className="max-w-2xl text-[#ffffff]">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-[#febd69] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#131921]">
              <Sparkles className="h-3.5 w-3.5" /> {loaded ? "Studio collection" : "Loading catalogue"}
            </span>
            <h1 className="mt-4 text-[clamp(30px,5vw,52px)] font-extrabold leading-[1.05] text-[#ffffff]">
              3D-printed products,
              <br />
              made to order and delivered.
            </h1>
            <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-[#d5dbdb]">
              Precision prints for desks, shelves and everyday use. Small batches, durable
              materials and free shipping across Tamil Nadu on larger orders.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link to="/shop" className="btn-primary px-5 py-2.5 text-[14px]">
                Shop all products
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 rounded-lg border border-white/45 px-5 py-2.5 text-[14px] font-semibold text-[#ffffff] transition hover:border-white hover:bg-white/10"
              >
                Today's deals <ArrowRight className="h-4 w-4" />
              </Link>
              {whatsappContactUrl && (
                <a
                  href={whatsappContactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[#febd69] hover:underline"
                >
                  <MessageCircle className="h-4 w-4" /> Custom print
                </a>
              )}
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#ccd1d1]">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-[#febd69]" /> Fast delivery
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#febd69]" /> Print quality checked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#febd69]" /> Printed to order
              </span>
            </div>
          </div>

          {/* Featured deal card */}
          <div className="relative mx-auto w-full max-w-[380px]">
            {heroProduct ? (
              <Link
                to={`/product/${heroProduct.slug}`}
                className="block overflow-hidden rounded-lg bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,.7)]"
              >
                <div className="flex items-center justify-between bg-[#cc0c39] px-3 py-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#ffffff]">
                    Deal of the day
                  </span>
                  <span className="rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#cc0c39]">
                    Limited
                  </span>
                </div>
                <div className="grid aspect-[4/3] place-items-center bg-white p-3">
                  <img src={heroProduct.imageUrl} alt={heroProduct.name} className="h-full w-full object-contain" />
                </div>
                <div className="px-4 pb-4">
                  <p className="line-clamp-2 text-[14px] leading-snug text-[#0f1111]">{heroProduct.name}</p>
                  <p className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-[22px] font-bold text-[#0f1111]">
                      {inr(effectiveProductPrice(heroProduct, now))}
                    </span>
                    {heroProduct.mrp && heroProduct.mrp > effectiveProductPrice(heroProduct, now) && (
                      <span className="text-[12px] text-[#565959] line-through">{inr(heroProduct.mrp)}</span>
                    )}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[#007185]">
                    View product <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ) : (
              <div className="grid aspect-[4/3] place-items-center rounded-lg border border-[#3a4553] bg-white/5">
                <div className="h-24 w-24 rounded-[26%] bg-gradient-to-br from-[#febd69] to-[#f08804] shadow-2xl" />
              </div>
            )}
          </div>
        </div>
        <div className="hero-fade" />
      </section>

      <div className="relative z-10 mx-auto -mt-16 max-w-[1500px] space-y-4 px-3 sm:-mt-20 sm:px-4">
        {/* Category cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {categories.slice(0, 4).map((category) => {
            const preview = categoryPreview(category);
            return (
              <Link
                key={category}
                to={`/shop?category=${encodeURIComponent(category)}`}
                className="cat-card p-3.5"
              >
                <h2 className="text-[16px] font-bold leading-tight">{category}</h2>
                <div className="mt-2 aspect-[4/3] overflow-hidden bg-[color:var(--surface)]">
                  {preview?.imageUrl ? (
                    <img src={preview.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <span className="grid h-14 w-14 place-items-center rounded-lg bg-[color:var(--surface-soft)] text-[color:var(--accent)]">
                        <Sparkles className="h-6 w-6" />
                      </span>
                    </div>
                  )}
                </div>
                <span className="mt-2.5 inline-block text-[13px] font-medium text-[color:var(--accent)]">
                  Shop now
                </span>
              </Link>
            );
          })}
        </div>

        <StorePromos />

        {categories.length === 0 && (
          <div className="amz-card px-4 py-8 text-center text-[13px] text-[color:var(--muted)]">
            {loaded ? "Products appear here once the studio publishes the catalogue." : "Loading the catalogue…"}
          </div>
        )}

        <PromotionBanner products={products} />

        {/* Deals rail */}
        {deals.length > 0 && (
          <Section title="Deals on 3D prints" to="/shop">
            <ProductRail products={deals} />
          </Section>
        )}

        {/* Best sellers */}
        {bestSellers.length > 0 && (
          <Section title="Best sellers in the studio" to="/shop">
            <ProductRail products={bestSellers} />
          </Section>
        )}

        {/* Category strip */}
        {categories.length > 4 && (
          <Section title="Shop by category" to="/shop">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {categories.map((category) => {
                const preview = categoryPreview(category);
                return (
                  <Link
                    key={category}
                    to={`/shop?category=${encodeURIComponent(category)}`}
                    className="group rounded-md border border-[color:var(--border)] p-2 transition hover:border-[color:var(--border-strong)] hover:shadow-sm"
                  >
                    <div className="grid aspect-square place-items-center overflow-hidden bg-[color:var(--surface)]">
                      {preview?.imageUrl ? (
                        <img
                          src={preview.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Sparkles className="h-7 w-7 text-[color:var(--border-strong)]" />
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-center text-[12.5px] font-medium text-[color:var(--heading)]">
                      {category}
                    </p>
                  </Link>
                );
              })}
            </div>
          </Section>
        )}

        {/* Info cards */}
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <section className="amz-card overflow-hidden p-5 sm:p-6">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--accent-strong)]">
              <Gift className="h-4 w-4" /> Rewards programme
            </span>
            <h2 className="mt-2 text-[22px] font-bold leading-tight">Partner offers and studio rewards.</h2>
            <p className="mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-[color:var(--muted)]">
              Browse current offers and their eligibility details. Reward assignments are managed
              manually by the studio after a qualifying order.
            </p>
            <div className="mt-4 flex flex-wrap gap-6 border-y border-[color:var(--border-soft)] py-3">
              <div>
                <p className="num text-[20px] font-bold text-[color:var(--heading)]">{inr(topPrize)}</p>
                <p className="text-[12px] text-[color:var(--muted)]">Top prize</p>
              </div>
              <div>
                <p className="num text-[20px] font-bold text-[color:var(--heading)]">{openPrizes.length}</p>
                <p className="text-[12px] text-[color:var(--muted)]">Open prizes</p>
              </div>
              <div>
                <p className="text-[20px] font-bold text-[color:var(--heading)]">Manual</p>
                <p className="text-[12px] text-[color:var(--muted)]">Assignment method</p>
              </div>
            </div>
            <Link to="/rewards" className="btn-primary mt-4">
              How prizes work <ArrowRight className="h-4 w-4" />
            </Link>
          </section>

          <section className="amz-card p-5 sm:p-6">
            <h2 className="text-[22px] font-bold leading-tight">Why customers come back</h2>
            <div className="mt-3 divide-y divide-[color:var(--border-soft)]">
              {[
                { title: "Product details", copy: "Review available materials, dimensions and other published specifications." },
                { title: "Custom projects", copy: "Contact the studio to discuss a part or print not listed in the catalogue." },
                { title: "Customer ID", copy: "Use the ID issued at checkout to look up your order history." },
              ].map((item) => (
                <div key={item.title} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-[13px] font-bold text-[color:var(--heading)]">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-[color:var(--muted)]">{item.copy}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 3D showcase */}
        <Product3DSlider products={products} />

        <Testimonials />

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Truck, title: "Delivery", copy: "Shipped across Tamil Nadu, tracked to your door." },
            { icon: ShieldCheck, title: "Quality", copy: "Each print is inspected before it is packed." },
            { icon: Layers, title: "Made to order", copy: "Small batches printed fresh, never mass produced." },
          ].map((item) => (
            <div key={item.title} className="amz-card flex items-start gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[color:var(--surface-soft)] text-[color:var(--accent)]">
                <item.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13.5px] font-bold text-[color:var(--heading)]">{item.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[color:var(--muted)]">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
