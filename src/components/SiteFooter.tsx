/**
 * Site footer — shop, company and contact columns.
 */

import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useStore } from "@/lib/store";

const shopLinks = [
  { to: "/shop", label: "All products" },
  { to: "/rewards", label: "Rewards" },
  { to: "/account", label: "My account" },
];

const companyLinks = [
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/shop", label: "Bulk & custom orders" },
];

export function SiteFooter() {
  const settings = useStore((state) => state.settings);

  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0f120f] py-12 text-[#f5f5f0]">
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#c6ff00]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="none">
                  <path d="M12 2.6 21 7.6v8.8L12 21.4 3 16.4V7.6l9-5Z" fill="#111311" />
                  <path d="M3.6 7.9 12 12.6l8.4-4.7M12 12.6v8.2" stroke="#c6ff00" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="leading-none">
                <p className="text-[16px] font-extrabold tracking-[-0.03em] text-[#f7f8f2]">{BRAND.name}</p>
                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.26em] text-[#c6ff00]/75">
                  {BRAND.tagline}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-[260px] text-[12px] leading-relaxed text-[#a9afa4]">
              Small-batch 3D-printed products and custom printing, made to order in {settings.city || BRAND.city}.
            </p>
            <Link
              to="/shop"
              className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#c6ff00] hover:underline"
            >
              Explore the catalogue <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#8b9087]">Shop</p>
            <ul className="mt-3 space-y-2.5">
              {shopLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-[12px] text-[#b9bdb5] transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#8b9087]">Company</p>
            <ul className="mt-3 space-y-2.5">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-[12px] text-[#b9bdb5] transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#8b9087]">Studio</p>
            <ul className="mt-3 space-y-2.5 text-[12px] text-[#b9bdb5]">
              <li className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#c6ff00]" /> {settings.city}
              </li>
              <li>
                <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2 hover:text-white">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-[#c6ff00]" /> {settings.supportEmail}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[#c6ff00]" /> {settings.supportPhone}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-9 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 md:flex-row">
          <p className="text-[11px] text-[#8b9087]">© 2026 {BRAND.name}. All rights reserved.</p>
          <p className="text-[11px] text-[#8b9087]">Razorpay TEST mode · No real payments are collected</p>
        </div>
      </div>
    </footer>
  );
}
