/**
 * Home page — hero, live product grid, workflow strip and prize CTA.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Gift, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { PromotionBanner } from "@/components/PromotionBanner";
import { inr } from "@/lib/format";
import { effectiveProductPrice, usePromotionClock } from "@/lib/promotions";
import { useStore } from "@/lib/store";

export function Home() {
  const products = useStore((state) => state.products) ?? [];
  const prizes = useStore((state) => state.prizes) ?? [];
  const loaded = useStore((state) => state.loaded);
  const message = useStore((state) => state.message);
  const now = usePromotionClock();

  const featured = products.slice(0, 8);
  const heroProduct = featured[0];
  const openPrizes = prizes.filter((prize) => prize.status === "open");
  const topPrize = openPrizes.reduce((best, prize) => (prize.worth > best ? prize.worth : best), 0);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-24 pb-16">
      {/* Hero */}
      <section className="glass liquid-edge relative grid gap-8 overflow-hidden rounded-[2rem] p-7 md:grid-cols-[1.15fr_0.85fr] md:items-center md:p-10">
        <div className="blob -right-24 -top-28 h-[320px] w-[320px] bg-violet-500/25 animate-drift" />
        <div className="blob -bottom-24 left-1/3 h-[260px] w-[260px] bg-coral/15 animate-drift-slow" />

        <div className="relative max-w-2xl">
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" /> Additive studio · Chennai
          </span>
          <h1 className="mt-4 text-[clamp(32px,5.6vw,58px)] leading-[1.02]">
            Objects that only exist
            <br />
            because you <span className="text-grad">asked</span>.
          </h1>
          <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-white/55">
            Browse the current catalogue of 3D-printed products, review their specifications,
            and contact the studio about custom printing.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary">
              Shop the catalogue <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/rewards" className="btn-glass">
              <Gift className="h-4 w-4" /> See the prizes
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { value: "3D printed", label: "Product catalogue" },
              { value: "Custom", label: "Project enquiries" },
              { value: "Secure", label: "Test-mode checkout" },
              { value: "Manual", label: "Reward assignments" },
            ].map((stat) => (
              <div key={stat.label} className="glass-soft rounded-2xl px-3.5 py-3">
                <p className="num text-[17px] font-bold text-white">{stat.value}</p>
                <p className="mt-0.5 text-[10.5px] text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {heroProduct && (
          <Link
            to={`/product/${heroProduct.slug}`}
            className="home-hero-feature group relative hidden min-h-[300px] overflow-hidden rounded-[1.5rem] border border-black/5 bg-[#eee9df] shadow-sm transition hover:-translate-y-1 hover:shadow-lg md:block"
            aria-label={`View ${heroProduct.name}`}
          >
            {heroProduct.imageUrl ? (
              <img
                src={heroProduct.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div
                  className="h-36 w-36 rotate-[-8deg] rounded-[30%] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(145deg, ${heroProduct.accent}, ${heroProduct.accent}88)`,
                    boxShadow: `0 28px 50px -20px ${heroProduct.accent}99`,
                  }}
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#171813]/80 via-transparent to-transparent" />
            <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#42463f]">
              {heroProduct.badge || heroProduct.trendTag || "Studio favourite"}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  {heroProduct.category}
                </p>
                <p className="mt-1 text-[19px] font-semibold leading-tight">{heroProduct.name}</p>
                <p className="mt-1 text-[13px] font-semibold">{inr(effectiveProductPrice(heroProduct, now))}</p>
              </div>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#29312d] transition-transform group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        )}
      </section>

      <PromotionBanner products={products} />

      {/* Catalogue */}
      <section className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">
              Catalogue
            </p>
            <h2 className="mt-1.5 text-[clamp(22px,3vw,30px)]">Featured prints</h2>
            <p className="mt-1 text-[12.5px] text-white/45">
              Browse available products and their published specifications.
            </p>
          </div>
          <Link to="/shop" className="btn-glass btn-sm text-[12px]">
            View all products <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        {featured.length === 0 && (
          <div className="glass-soft rounded-2xl px-4 py-8 text-center text-[12.5px] text-white/50">
            {loaded ? message ?? "No products are published yet." : "Loading the catalogue…"}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mt-12 glass liquid-edge rounded-[2rem] p-6 md:p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">
          How it works
        </p>
        <h2 className="mt-1.5 text-[clamp(20px,2.6vw,26px)]">How ordering works</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: "01", title: "Pick your print", copy: "Choose stock pieces or send a file for a made-to-order quote." },
            { step: "02", title: "Customer ID", copy: "A customer ID is created or reused when you place an order." },
            { step: "03", title: "Test checkout", copy: "This deployment uses Razorpay Test Mode; no real payments are collected." },
            { step: "04", title: "Order updates", copy: "Check order status with the customer ID issued at checkout." },
          ].map((item) => (
            <div key={item.step} className="glass-soft rounded-2xl p-4">
              <span className="num text-[10px] font-bold tracking-[0.2em] text-violet-300">
                {item.step}
              </span>
              <p className="mt-1.5 text-[13px] font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/45">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards */}
      <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="glass-deep liquid-edge rounded-[2rem] p-7">
          <span className="eyebrow">Rewards programme</span>
          <h2 className="mt-2 text-[24px]">Partner offers and rewards.</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/50">
            Browse current offers and their eligibility details. The studio manages prize assignments
            manually; no automatic draw is performed.
          </p>
          <div className="mt-5 flex flex-wrap gap-6">
            <div>
              <p className="num text-[22px] font-bold text-white">{inr(topPrize)}</p>
              <p className="text-[10.5px] text-white/40">Top prize</p>
            </div>
            <div>
              <p className="num text-[22px] font-bold text-white">{openPrizes.length}</p>
              <p className="text-[10.5px] text-white/40">Open prizes</p>
            </div>
            <div>
              <p className="text-[22px] font-bold text-white">Manual</p>
              <p className="text-[10.5px] text-white/40">Assignment method</p>
            </div>
          </div>
          <Link to="/rewards" className="btn-primary mt-6 inline-flex">
            How prizes work
          </Link>
        </div>

        <div className="glass rounded-[2rem] p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-300">
            Why customers come back
          </p>
          <h2 className="mt-1.5 text-[22px]">Made to be handled, not just displayed.</h2>
          <div className="mt-4 grid gap-2.5">
            {[
              { title: "Product details", copy: "Review available materials, dimensions and other published specifications." },
              { title: "Custom projects", copy: "Contact the studio to discuss a part or print not listed in the catalogue." },
              { title: "Customer ID", copy: "Use the ID issued at checkout to look up your order history." },
            ].map((item) => (
              <div key={item.title} className="glass-soft rounded-2xl p-3.5">
                <p className="text-[12.5px] font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/45">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
