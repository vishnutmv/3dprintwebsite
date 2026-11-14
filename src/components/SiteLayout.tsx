import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Backdrop } from "./Backdrop";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ReturningCustomerPrompt } from "./ReturningCustomerPrompt";
import { Toaster } from "./Toaster";
import { useStore } from "@/lib/store";
import { useAccount } from "@/lib/account";
import { useSocial } from "@/lib/social";
import { useToast } from "@/lib/toast";
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
  const customer = useAccount((state) => state.customer);
  const accountLoaded = useAccount((state) => state.loaded);
  const refreshAccount = useAccount((state) => state.refresh);
  const loadedFor = useSocial((state) => state.loadedFor);
  const fetchSocial = useSocial((state) => state.fetchSocial);
  const pushToast = useToast((state) => state.push);
  const lastUnread = useRef(0);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!accountLoaded) void refreshAccount();
  }, [accountLoaded, refreshAccount]);

  useEffect(() => {
    if (customer && loadedFor !== customer.code) void fetchSocial(customer.code);
    if (!customer && loadedFor) useSocial.getState().reset();
  }, [customer, fetchSocial, loadedFor]);

  // Poll the customer inbox so order/status/review replies surface as an
  // in-site alert while the storefront is open.
  useEffect(() => {
    if (!customer) {
      lastUnread.current = 0;
      return;
    }
    lastUnread.current = useSocial.getState().unreadCount;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      await useSocial.getState().refreshNotifications();
      const state = useSocial.getState();
      if (state.unreadCount > lastUnread.current) {
        const latest = state.notifications.find((notification) => !notification.readAt);
        if (latest) pushToast(`${latest.title}`, "success");
      }
      lastUnread.current = state.unreadCount;
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [customer, pushToast]);

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
