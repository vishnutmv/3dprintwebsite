import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, ServerCog } from "lucide-react";
import { getAdminSettings, saveAdminSettings, type AdminCapabilities } from "@/lib/admin";
import type { StoreSettings } from "@/lib/types";
import { useToast } from "@/lib/toast";

type SettingsForm = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  city: string;
  gstin: string;
  freeShippingOver: string;
  shippingFlat: string;
};

const emptyForm: SettingsForm = {
  storeName: "",
  supportEmail: "",
  supportPhone: "",
  city: "",
  gstin: "",
  freeShippingOver: "0",
  shippingFlat: "0",
};

function formFromSettings(settings: StoreSettings): SettingsForm {
  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    city: settings.city,
    gstin: settings.gstin,
    freeShippingOver: String(settings.freeShippingOver / 100),
    shippingFlat: String(settings.shippingFlat / 100),
  };
}

function Capability({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-white/8 px-3 py-2">
      <span>{label}</span>
      <span className={enabled ? "flex items-center gap-1.5 text-mint" : "flex items-center gap-1.5 text-sun"}>
        {enabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {enabled ? "Configured" : "Not configured"}
      </span>
    </li>
  );
}

export function AdminSettings() {
  const toast = useToast((state) => state.push);
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [capabilities, setCapabilities] = useState<AdminCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getAdminSettings()
      .then((result) => {
        if (!active) return;
        setForm(formFromSettings(result.settings));
        setCapabilities(result.capabilities);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load settings.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await saveAdminSettings({
        storeName: form.storeName,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        city: form.city,
        gstin: form.gstin,
        freeShippingOver: Math.round(Number(form.freeShippingOver || 0) * 100),
        shippingFlat: Math.round(Number(form.shippingFlat || 0) * 100),
      });
      setForm(formFromSettings(result.settings));
      setCapabilities(result.capabilities);
      toast("Settings saved");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save settings.";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof SettingsForm) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Configuration</p>
        <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Settings</h1>
        <p className="mt-1 text-[12.5px] text-white/45">Store identity, shipping rules and deployment integrations.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">{error}</p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="glass rounded-3xl p-5">
          <h2 className="text-[15px]">Store</h2>
          {loading ? (
            <p className="mt-4 flex items-center gap-2 text-[12px] text-white/45">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="storeName">Store name</label>
                  <input id="storeName" className="field" value={form.storeName} onChange={setField("storeName")} />
                </div>
                <div>
                  <label className="label" htmlFor="gstin">GSTIN</label>
                  <input id="gstin" className="field font-mono text-[12px]" value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="label" htmlFor="supportEmail">Support email</label>
                  <input id="supportEmail" type="email" className="field" value={form.supportEmail} onChange={setField("supportEmail")} />
                </div>
                <div>
                  <label className="label" htmlFor="supportPhone">Support phone</label>
                  <input id="supportPhone" className="field" value={form.supportPhone} onChange={setField("supportPhone")} />
                </div>
                <div>
                  <label className="label" htmlFor="city">City</label>
                  <input id="city" className="field" value={form.city} onChange={setField("city")} />
                </div>
              </div>

              <h2 className="mt-6 text-[15px]">Shipping</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="freeOver">Free shipping over ₹</label>
                  <input id="freeOver" className="field" type="number" min="0" step="0.01" value={form.freeShippingOver} onChange={setField("freeShippingOver")} />
                </div>
                <div>
                  <label className="label" htmlFor="flat">Flat shipping ₹</label>
                  <input id="flat" className="field" type="number" min="0" step="0.01" value={form.shippingFlat} onChange={setField("shippingFlat")} />
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save settings
                </button>
              </div>
            </>
          )}
        </div>

        <div className="grid content-start gap-4">
          <div className="glass rounded-3xl p-5">
            <h2 className="flex items-center gap-2 text-[15px]">
              <ServerCog className="h-4 w-4 text-mint" /> Deployment status
            </h2>
            {capabilities ? (
              <ul className="mt-3 grid gap-2 text-[11px]">
                <Capability label="InterServer MariaDB" enabled={capabilities.database} />
                <Capability label="Razorpay TEST mode" enabled={capabilities.razorpayTestMode} />
                <Capability label="Razorpay webhook verification" enabled={capabilities.razorpayWebhook} />
                <Capability label="Admin server authentication" enabled={capabilities.adminAuth} />
                <Capability label="Email delivery" enabled={capabilities.email} />
                <Capability label="Notification webhook (e.g. WhatsApp provider)" enabled={capabilities.webhook} />
              </ul>
            ) : !loading ? (
              <p className="mt-3 text-[11.5px] text-white/45">Integration status could not be loaded.</p>
            ) : null}
            <p className="mt-4 text-[10.5px] leading-relaxed text-white/40">
              Credentials are configured in the server-only api/config.php file. Secret keys are never displayed or editable here.
              Payments are restricted to Razorpay test keys; live keys are rejected by the server.
            </p>
          </div>

          <div className="rounded-3xl border border-sun/25 bg-sun/[0.05] p-5">
            <h2 className="flex items-center gap-2 text-[14px] text-sun">
              <AlertTriangle className="h-4 w-4" /> Before going live
            </h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-white/55">
              This project is intentionally configured for Razorpay TEST mode. Verify business, tax, shipping, refund and
              prize terms with the client and an India-qualified professional before accepting real orders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
