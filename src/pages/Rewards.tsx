/**
 * Rewards page — live open prizes from the PHP API.
 * Prizes are awarded manually by the studio; there is no automatic draw.
 */

import { Gift, Sparkles } from "lucide-react";
import { inr } from "@/lib/format";
import { useStore } from "@/lib/store";

export function Rewards() {
  const prizes = useStore((state) => state.prizes) ?? [];
  const products = useStore((state) => state.products) ?? [];
  const loaded = useStore((state) => state.loaded);

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-[1200px] px-4">
        <header className="glass liquid-edge mb-8 rounded-3xl p-6">
          <span className="eyebrow">
            <Sparkles className="h-3.5 w-3.5" /> Prize programme
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">Rewards and vouchers</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-white/50">
            Review each current offer and its eligibility details. The studio assigns rewards manually;
            the website does not run an automatic lucky draw.
          </p>
        </header>

        <div className="grid gap-6">
          <div className="glass liquid-edge rounded-3xl p-6">
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-white/50">
              How it works
            </h2>
            <ol className="list-decimal space-y-2 pl-6 text-[13px] text-white/60">
              <li>Check each reward's published eligibility and campaign terms.</li>
              <li>The studio administrator selects an eligible customer ID manually; there is no automatic draw.</li>
              <li>The assignment is recorded against the customer ID in the admin panel.</li>
              <li>Notifications are attempted only through configured providers; availability is shown in the admin history.</li>
              <li>Contact the store for fulfilment and redemption details.</li>
            </ol>
          </div>

          <div className="glass liquid-edge rounded-3xl p-6">
            <h2 className="mb-4 text-[13px] font-bold uppercase tracking-[0.1em] text-white/50">
              Current prizes
            </h2>

            {prizes.length === 0 ? (
              <p className="text-[13px] text-white/45">
                {loaded ? "No prizes are open right now. Check back later or contact the store." : "Loading prizes…"}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {prizes.map((prize) => (
                  <div key={prize.id} className="rounded-2xl border border-white/8 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-sun" />
                        <p className="text-[14px] font-semibold text-white">{prize.title}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-mint">
                        {prize.status}
                      </span>
                    </div>
                    {prize.description && (
                      <p className="mt-2 text-[12px] leading-relaxed text-white/50">{prize.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
                      <span className="num text-violet-200">{inr(prize.worth)}</span>
                      {prize.sponsor && <span>{prize.sponsor}</span>}
                      {prize.cycle && <span>Cycle {prize.cycle}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { value: String(prizes.length), label: "Open prizes now" },
              { value: String(prizes.reduce((best, prize) => Math.max(best, prize.worth), 0) / 100 || 0), label: "Top prize value" },
              { value: String(products.length), label: "Catalogue products" },
              { value: "Manual", label: "Award method" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-4 text-center">
                <p className="num text-xl font-semibold text-violet-300">{stat.value}</p>
                <p className="mt-1 text-[10.5px] text-white/40">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
