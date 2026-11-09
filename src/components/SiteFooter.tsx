/**
 * Site footer — shop, company and contact columns.
 */

import { Link } from "react-router-dom";
import { useStore } from "@/lib/store";

const shopLinks = [
  { to: "/shop", label: "Catalogue" },
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
    <footer className="mt-auto border-t border-white/10 py-12">
      <div className="mx-auto max-w-[1280px] px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[13px] font-semibold text-white">3D Print Co.</p>
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
              3D-printed products and custom printing enquiries.
            </p>
            <p className="mt-3 text-[11px] text-white/35">Social links will be added when supplied by the store.</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Shop</p>
            <ul className="mt-3 space-y-2">
              {shopLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-[12px] text-white/50 transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Company</p>
            <ul className="mt-3 space-y-2">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-[12px] text-white/50 transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Studio</p>
            <ul className="mt-3 space-y-2 text-[12px] text-white/50">
              <li>{settings.city}</li>
              <li><a href={`mailto:${settings.supportEmail}`} className="hover:text-white">{settings.supportEmail}</a></li>
              <li>{settings.supportPhone}</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 md:flex-row">
          <p className="text-[11px] text-white/30">© 2026 3D Print Co. All rights reserved.</p>
          <p className="text-[11px] text-white/30">Razorpay TEST mode · No real payments are collected</p>
        </div>
      </div>
    </footer>
  );
}
