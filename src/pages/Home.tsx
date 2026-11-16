/**
 * Home page — premium hero, category showcase, live product grid and rewards.
 */

import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Gamepad2,
  Gift,
  Headphones,
  Home as HomeIcon,
  Layers,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import { Product3DSlider } from "@/components/Product3DSlider";
import { PromotionBanner } from "@/components/PromotionBanner";
import { StorePromos } from "@/components/StorePromos";
import { Testimonials } from "@/components/Testimonials";
import { inr } from "@/lib/format";
import { effectiveProductPrice, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

const CATEGORY_ICONS = [Box, HomeIcon, Wrench, Gamepad2, Layers, Headphones, Package, Sparkles];

function categoryIcon(category: string, index: number) {
  const name = category.toLowerCase();
  if (name.includes("figur") || name.includes("mini")) return Box;
  if (name.includes("decor") || name.includes("home")) return HomeIcon;
  if (name.includes("gadget") || name.includes("tool")) return Wrench;
  if (name.includes("game") || name.includes("console")) return Gamepad2;
  if (name.includes("desk") || name.includes("organ")) return Layers;
  if (name.includes("audio") || name.includes("head")) return Headphones;
  if (name.includes("part") || name.includes("spare")) return Package;
  return CATEGORY_ICONS[index % CATEGORY_ICONS.length];
}

export function Home() {
  const products = useStore((state) => state.products) ?? [];
  const prizes = useStore((state) => state.prizes) ?? [];
  const loaded = useStore((state) => state.loaded);
  const whatsappContactUrl = useStore((state) => state.settings.whatsappContactUrl);
  const now = usePromotionClock();

  const featured = products.slice(0, 8);
  const heroProduct = featured[0];
  const openPrizes = prizes.filter((prize) => prize.status === "open");
  const topPrize = openPrizes.reduce((best, prize) => (prize.worth > best ? prize.worth : best), 0);

  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).slice(0, 6);
  const categoryPreview = (category: string): Product | undefined =>
    products.find((product) => product.category === category && product.imageUrl) ??
    products.find((product) => product.category === category);

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-24 md:pt-28">
      {/* Hero */}
      <section className="hero-shell p-5 sm:p-7 md:p-10 lg:p-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div className="relative z-10 max-w-2xl">
            <span className="hero-eyebrow">
              <Sparkles className="h-3.5 w-3.5" /> Premium 3D prints
            </span>

            <h1 className="hero-title mt-5 text-[clamp(38px,6.4vw,68px)]">
              Bring Ideas to
              <br />
              Life <span className="hero-lime">in 3D</span>
            </h1>

            <p className="hero-copy mt-4 max-w-[520px] text-[13.5px] leading-relaxed sm:text-[15px]">
              High-quality, precision 3D-printed products for creators, gamers, collectors
              and everyday life. Made to order in Chennai.
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5 sm:gap-3">
              <Link to="/shop" className="btn-hero-primary">
                Shop Collection <ArrowRight className="h-4 w-4" />
              </Link>
              {whatsappContactUrl ? (
                <a
                  href={whatsappContactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-hero-ghost"
                >
                  Custom Print <MessageCircle className="h-4 w-4" />
                </a>
              ) : (
                <Link to="/shop" className="btn-hero-ghost">
                  Custom Print <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            <div className="hero-trust mt-8 grid grid-cols-1 gap-4 pt-5 sm:grid-cols-3 sm:gap-0">
              {[
                { icon: Truck, title: "Fast delivery", copy: "Shipped across India" },
                { icon: ShieldCheck, title: "Print quality", copy: "Precision & durable" },
                { icon: Layers, title: "Small batches", copy: "Printed to order" },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className={`hero-trust-item flex items-center gap-2.5 ${
                    index > 0 ? "sm:pl-4" : ""
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#c6ff00]/25 bg-[#c6ff00]/10 text-[#c6ff00]">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[11.5px] font-semibold text-[#eef0e8]">{item.title}</span>
                    <span className="block text-[10.5px] text-[#8f948b]">{item.copy}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Product visual */}
          <div className="relative">
            <div className="hero-visual-frame aspect-[4/3.35] w-full sm:aspect-[4/3]">
              {heroProduct?.imageUrl ? (
                <img
                  src={heroProduct.imageUrl}
                  alt={heroProduct.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <>
                  <div className="hero-ring h-[86%] w-[86%]" />
                  <div className="hero-ring h-[64%] w-[64%] border-[#c6ff00]/35" />
                  <div className="hero-object" />
                  <div className="hero-plinth" />
                  <div className="absolute left-[13%] top-[12%] h-[46%] w-[1px] bg-gradient-to-b from-transparent via-white/15 to-transparent" />
                  <div className="absolute right-[12%] top-[8%] h-[58%] w-[1px] bg-gradient-to-b from-transparent via-[#c6ff00]/25 to-transparent" />
                  <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#d7ff38] backdrop-blur">
                    Printed layer by layer
                  </span>
                </>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#c6ff00]">
                      {heroProduct ? heroProduct.category : "Studio collection"}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold leading-tight text-[#f7f8f2]">
                      {heroProduct ? heroProduct.name : "Made to order, printed fresh"}
                    </p>
                    {heroProduct && (
                      <p className="mt-0.5 text-[12px] font-semibold text-[#e7eae1]">
                        {inr(effectiveProductPrice(heroProduct, now))}
                      </p>
                    )}
                  </div>
                  {heroProduct && (
                    <Link
                      to={`/product/${heroProduct.slug}`}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#c6ff00] text-[#111311] transition hover:scale-105"
                      aria-label={`View ${heroProduct.name}`}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Collections
            </p>
            <h2 className="mt-1.5 text-[clamp(24px,3.4vw,34px)]">
              Shop by <span className="text-[color:var(--accent)]">Category</span>
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--text)] transition hover:text-[color:var(--accent)]"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="glass-soft rounded-2xl px-4 py-8 text-center text-[12.5px] text-[color:var(--muted)]">
            {loaded ? "Categories appear when products are published." : "Loading the catalogue…"}
          </div>
        ) : (
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {categories.map((category, index) => {
              const preview = categoryPreview(category);
              const Icon = categoryIcon(category, index);
              return (
                <Link
                  key={category}
                  to={`/shop?category=${encodeURIComponent(category)}`}
                  className="cat-card w-[156px] shrink-0 snap-start sm:w-auto"
                >
                  <div className="cat-card-media">
                    {preview?.imageUrl ? (
                      <img src={preview.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <span
                        className="grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--accent)] shadow-sm"
                        aria-hidden="true"
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                    <span className="truncate text-[12.5px] font-semibold text-[color:var(--heading)]">
                      {category}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--faint)]" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-12">
        <Product3DSlider products={products} />
      </div>

      <PromotionBanner products={products} />
      <StorePromos />

      <Testimonials />

      {/* Rewards */}
      <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#101310] p-6 text-[#f5f5f0] md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#c6ff00]/10 blur-3xl" />
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#c6ff00]">
            <Gift className="h-3.5 w-3.5" /> Rewards programme
          </span>
          <h2 className="mt-2.5 text-[clamp(21px,2.8vw,27px)] text-[#f7f8f2]">Partner offers and rewards.</h2>
          <p className="mt-2 max-w-[440px] text-[12.5px] leading-relaxed text-[#a9afa4]">
            Browse current offers and their eligibility details. Reward assignments are managed
            manually by the studio.
          </p>
          <div className="mt-5 flex flex-wrap gap-7">
            <div>
              <p className="num text-[22px] font-bold text-[#f7f8f2]">{inr(topPrize)}</p>
              <p className="text-[10.5px] text-[#8f948b]">Top prize</p>
            </div>
            <div>
              <p className="num text-[22px] font-bold text-[#f7f8f2]">{openPrizes.length}</p>
              <p className="text-[10.5px] text-[#8f948b]">Open prizes</p>
            </div>
            <div>
              <p className="text-[22px] font-bold text-[#f7f8f2]">Manual</p>
              <p className="text-[10.5px] text-[#8f948b]">Assignment method</p>
            </div>
          </div>
          <Link to="/rewards" className="btn-hero-primary mt-6">
            How prizes work <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 md:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--accent)]">
            Why customers come back
          </p>
          <h2 className="mt-1.5 text-[20px]">Made to be handled, not just displayed.</h2>
          <div className="mt-4 grid gap-2.5">
            {[
              { title: "Product details", copy: "Review available materials, dimensions and other published specifications." },
              { title: "Custom projects", copy: "Contact the studio to discuss a part or print not listed in the catalogue." },
              { title: "Customer ID", copy: "Use the ID issued at checkout to look up your order history." },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-soft)] p-3.5"
              >
                <p className="text-[12.5px] font-semibold text-[color:var(--heading)]">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-[color:var(--muted)]">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
