import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Backdrop } from "./Backdrop";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ReturningCustomerPrompt } from "./ReturningCustomerPrompt";
import { Toaster } from "./Toaster";
import { useStore } from "@/lib/store";
import { demoMode } from "@/lib/demo-mode";

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

export function SiteLayout() {
  const bootstrap = useStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      {demoMode && (
        <div className="relative z-50 border-b border-sun/20 bg-sun/10 px-4 py-2 text-center text-[11px] font-medium text-sun">
          Client preview · Sample catalogue and orders only · No live backend or real payments
        </div>
      )}
      <Backdrop />
      <ScrollToTop />
      <div className="storefront-shell relative flex min-h-screen flex-col">
        <SiteHeader />
        <main className="relative z-10 flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <ReturningCustomerPrompt />
      <Toaster />
    </>
  );
}
