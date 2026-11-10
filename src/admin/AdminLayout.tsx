import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Boxes,
  Gauge,
  Gift,
  Loader2,
  LogOut,
  MessageCircle,
  Package,
  Settings2,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { AdminMark } from "@/components/Logo";
import { Toaster } from "@/components/Toaster";
import { useAdminAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { demoMode } from "@/lib/demo-mode";
import { getNewLeadCount } from "@/lib/admin";

const nav = [
  { to: "/admin", label: "Dashboard", icon: Gauge, end: true },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: Package },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/leads", label: "WhatsApp Inbox", icon: MessageCircle },
  { to: "/admin/prizes", label: "Prizes", icon: Gift },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

function LoginScreen() {
  const signIn = useAdminAuth((state) => state.signIn);
  const signingIn = useAdminAuth((state) => state.signingIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await signIn(email, password);
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="glass-deep liquid-edge w-full max-w-[400px] rounded-[2rem] p-7">
        <AdminMark />
        <h1 className="mt-6 text-[26px] leading-tight">Studio admin</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/50">
          {demoMode
            ? "Sign in to the local client preview. All sample changes stay in this browser."
            : "Sign in with the admin account configured on the server. Products, orders, customers, WhatsApp enquiries and prize awards live here."}
        </p>

        <form className="mt-6" onSubmit={submit}>
          <label className="label" htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
            placeholder="admin@3dprintco.in"
            autoComplete="username"
            autoFocus
            required
          />

          <label className="label mt-3" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          {error && <p className="mt-2 text-[11.5px] text-coral">{error}</p>}

          <button type="submit" className="btn-primary mt-4 w-full" disabled={signingIn}>
            {signingIn ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</>
            ) : (
              <><ShieldCheck className="h-4 w-4" /> Enter admin</>
            )}
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-white/40">
          {demoMode
            ? "Demo credentials are for this local preview only. Do not use this sign-in mode in production."
            : "Credentials are verified on the server. The 8-hour session is held in an HttpOnly cookie and is not accessible to browser JavaScript."}
        </div>

        <NavLink to="/" className="mt-5 flex items-center gap-2 text-[11.5px] text-white/40 hover:text-white">
          <Store className="h-3.5 w-3.5" /> Back to the shop
        </NavLink>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const authenticated = useAdminAuth((state) => state.authenticated);
  const initialized = useAdminAuth((state) => state.initialized);
  const signOut = useAdminAuth((state) => state.signOut);
  const verify = useAdminAuth((state) => state.verify);
  const settings = useStore((state) => state.settings);
  const fetchSettings = useStore((state) => state.fetchSettings);
  const toast = useToast((state) => state.push);
  const location = useLocation();
  const [newLeadCount, setNewLeadCount] = useState(0);

  useEffect(() => {
    if (authenticated) void fetchSettings();
  }, [authenticated, fetchSettings]);

  useEffect(() => {
    if (!initialized) void verify();
  }, [initialized, verify]);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const refreshCount = async () => {
      try {
        const count = await getNewLeadCount();
        if (active) setNewLeadCount(count);
      } catch (caught) {
        if (active) console.error("Could not refresh WhatsApp enquiry count:", caught);
      }
    };
    void refreshCount();
    const interval = window.setInterval(() => void refreshCount(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authenticated, location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not end the admin session.", "error");
    }
  };

  if (!initialized) {
    return (
      <div className="grid min-h-screen place-items-center text-[13px] text-white/45">
        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking admin session…</span>
      </div>
    );
  }
  if (!authenticated) return <LoginScreen />;

  return (
    <div className="mx-auto flex max-w-[1280px] gap-5 px-3 py-4">
      <Toaster />
      <aside className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-[220px] shrink-0 flex-col rounded-3xl p-3 lg:flex">
        <div className="px-2 py-3">
          <AdminMark />
        </div>

        <nav className="mt-2 grid gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition",
                  isActive
                    ? "bg-violet-500/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.12)]"
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.to === "/admin/leads" && newLeadCount > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-sun px-1.5 py-0.5 text-center text-[9px] font-bold text-ink-950">
                  {newLeadCount > 99 ? "99+" : newLeadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto grid gap-2 px-1 pb-1">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35">Store</p>
            <p className="mt-1 truncate text-[12px] font-semibold text-white">{settings.storeName}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-white/35">
              <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? "bg-sun" : "bg-mint"}`} />
              {demoMode ? "Demo · this browser" : "InterServer · live"}
            </p>
          </div>
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12.5px] text-white/50 hover:bg-white/[0.05] hover:text-white"
          >
            <Store className="h-4 w-4" /> View shop
          </NavLink>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-[12.5px] text-white/50 hover:bg-coral/10 hover:text-coral"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {demoMode && (
          <div className="mb-4 rounded-2xl border border-sun/20 bg-sun/10 px-4 py-3 text-[11px] leading-relaxed text-sun">
            Client preview · Sample customer/order data only · Admin edits stay in this browser · No real payment or notifications
          </div>
        )}
        <div className="glass mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl p-2 lg:hidden">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium",
                  isActive ? "bg-violet-500/25 text-white" : "text-white/50",
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {item.to === "/admin/leads" && newLeadCount > 0 && (
                <span className="rounded-full bg-sun px-1.5 py-0.5 text-[9px] font-bold text-ink-950">
                  {newLeadCount > 99 ? "99+" : newLeadCount}
                </span>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="ml-auto shrink-0 rounded-xl px-3 py-2 text-[12px] text-coral"
          >
            Exit
          </button>
        </div>

        <div key={location.pathname} className="animate-pop pb-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
