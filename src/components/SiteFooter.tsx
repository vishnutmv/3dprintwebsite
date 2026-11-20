/**
 * Site footer — Amazon-style navy footer: back-to-top bar, link columns,
 * studio contact details and the legal strip.
 */

import { Link } from "react-router-dom";
import { ArrowUp, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./Logo";
import { BRAND } from "@/lib/brand";
import { useStore } from "@/lib/store";

const columns = [
  {
    title: "Get to know us",
    links: [
      { to: "/shop", label: "All products" },
      { to: "/rewards", label: "Rewards programme" },
      { to: "/shop", label: "Custom printing" },
    ],
  },
  {
    title: "Shop with us",
    links: [
      { to: "/shop", label: "Catalogue" },
      { to: "/cart", label: "Your cart" },
      { to: "/account?tab=orders", label: "Your orders" },
    ],
  },
  {
    title: "Let us help you",
    links: [
      { to: "/account", label: "Your account" },
      { to: "/terms", label: "Terms of use" },
      { to: "/privacy", label: "Privacy notice" },
    ],
  },
];

export function SiteFooter() {
  const settings = useStore((state) => state.settings);

  return (
    <footer className="mt-auto">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="block w-full bg-[color:var(--footer-top)] py-3.5 text-center text-[13px] font-medium text-[#ffffff] transition hover:bg-[#485769]"
      >
        <ArrowUp className="mr-1.5 inline h-3.5 w-3.5" />
        Back to top
      </button>

      <div className="bg-[color:var(--footer-bg)] text-[#ddd]">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-10 sm:grid-cols-2 md:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[15px] font-bold text-[#ffffff]">{column.title}</p>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-[13px] text-[#ddd] transition hover:underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-[15px] font-bold text-[#ffffff]">Studio contact</p>
            <ul className="mt-3 space-y-2.5 text-[13px]">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#febd69]" />
                {settings.city || BRAND.city}
              </li>
              <li>
                <a href={`mailto:${settings.supportEmail}`} className="flex items-start gap-2 hover:underline">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#febd69]" />
                  {settings.supportEmail}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#febd69]" />
                {settings.supportPhone}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#3a4553] py-7 text-center">
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="mt-3 text-[12px] text-[#ddd]">
            Small-batch 3D printing, made to order in {settings.city || BRAND.city}.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[#ddd]">
            <Link to="/terms" className="hover:underline">
              Conditions of use
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy notice
            </Link>
            <Link to="/account" className="hover:underline">
              Your account
            </Link>
            <Link to="/rewards" className="hover:underline">
              Rewards
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-[color:var(--footer-bg)] pb-6 pt-1 text-center text-[11px] text-[#999]">
        <p>© 2026 {BRAND.name}. All rights reserved.</p>
        <p className="mt-1">Razorpay TEST mode · No real payments are collected</p>
      </div>
    </footer>
  );
}
