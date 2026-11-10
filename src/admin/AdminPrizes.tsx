import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Loader2, RotateCcw, Send } from "lucide-react";
import { inr, shortDate } from "@/lib/format";
import { demoMode } from "@/lib/demo-mode";
import { useToast } from "@/lib/toast";
import {
  assignPrize as assignPrizeRequest,
  createPrize,
  deleteMedia,
  getCustomers,
  getPrizes,
  updatePrize,
  type AdminAssignment,
  type AdminCustomer,
  type AdminPrize,
} from "@/lib/admin";
import { uploadMedia } from "@/lib/storage";

type PrizeForm = {
  title: string;
  description: string;
  prizeType: string;
  voucherCode: string;
  worth: string;
  quantity: string;
  sponsor: string;
  cycle: string;
};

const emptyPrize: PrizeForm = {
  title: "",
  description: "",
  prizeType: "regular",
  voucherCode: "",
  worth: "0",
  quantity: "1",
  sponsor: "",
  cycle: "",
};

export function AdminPrizes() {
  const toast = useToast((state) => state.push);
  const [prizes, setPrizes] = useState<AdminPrize[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);
  const [prizeId, setPrizeId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [form, setForm] = useState<PrizeForm>(emptyPrize);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingMediaFor, setUploadingMediaFor] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prizeData, customerData] = await Promise.all([getPrizes(), getCustomers()]);
      setPrizes(prizeData.prizes);
      setAssignments(prizeData.assignments);
      setCustomers(customerData.filter((customer) => customer.paidOrders > 0));
      setPrizeId((current) =>
        prizeData.prizes.some((prize) => prize.id === current && prize.status === "open")
          ? current
          : prizeData.prizes.find((prize) => prize.status === "open")?.id ?? "",
      );
      setCustomerId((current) =>
        customerData.some((customer) => customer.customerCode === current && customer.paidOrders > 0)
          ? current
          : customerData.find((customer) => customer.paidOrders > 0)?.customerCode ?? "",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load prizes and customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedPrize = prizes.find((prize) => prize.id === prizeId);
  const selectedCustomer = customers.find((customer) => customer.customerCode === customerId);
  const message = useMemo(() => {
    if (!selectedPrize || !selectedCustomer) return "";
    return [
      `Hi ${selectedCustomer.name.split(" ")[0]}, a reward card from 3D Print Co. is ready for you.`,
      "",
      `Reward: ${selectedPrize.title}`,
      "Scratch the private card link in the WhatsApp message to reveal the reward.",
      "The reward can only be revealed once.",
      "",
      "— 3D Print Co.",
    ].filter(Boolean).join("\n");
  }, [selectedCustomer, selectedPrize]);

  const savePrize = async (event: React.FormEvent) => {
    event.preventDefault();
    const worthRupees = Number(form.worth);
    if (!form.title.trim() || !Number.isFinite(worthRupees) || worthRupees < 0) {
      toast("Enter a prize title and a valid value.", "warn");
      return;
    }
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      toast("Enter a valid prize quantity between 1 and 100000.", "warn");
      return;
    }
    setSaving(true);
    try {
      await createPrize({
        ...form,
        worth: Math.round(worthRupees * 100),
        quantity,
        voucherCode: form.voucherCode.trim() || null,
      });
      setForm(emptyPrize);
      toast("Prize added");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not create prize.", "error");
    } finally {
      setSaving(false);
    }
  };

  const awardPrize = async () => {
    if (!selectedPrize || !selectedCustomer) return;
    setSaving(true);
    try {
      const assignment = await assignPrizeRequest({
        prizeId: selectedPrize.id,
        customerId: selectedCustomer.customerCode,
      });
      toast(
        assignment.notificationStatus === "sent"
          ? `${selectedPrize.title} awarded; the configured provider accepted the notification.`
          : `${selectedPrize.title} awarded; notification ${assignment.notificationStatus}.`,
        assignment.notificationStatus === "failed" ? "warn" : "success",
      );
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not award prize.", "error");
    } finally {
      setSaving(false);
    }
  };

  const releasePrize = async (prize: AdminPrize) => {
    setSaving(true);
    try {
      await updatePrize(prize.id, { status: "open" });
      toast("Prize released back to the available pool", "warn");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not release prize.", "error");
    } finally {
      setSaving(false);
    }
  };

  const attachMedia = async (prize: AdminPrize, file: File) => {
    setUploadingMediaFor(prize.id);
    try {
      const uploaded = await uploadMedia("prize-media", file);
      await updatePrize(prize.id, { mediaUrls: [...(prize.mediaUrls ?? []), uploaded.url] });
      toast("Prize media uploaded");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not upload prize media.", "error");
    } finally {
      setUploadingMediaFor(null);
    }
  };

  const removePrizeMedia = async (prize: AdminPrize, url: string) => {
    try {
      await updatePrize(prize.id, { mediaUrls: (prize.mediaUrls ?? []).filter((item) => item !== url) });
      let cleanupFailed = false;
      try {
        await deleteMedia(url);
      } catch (caught) {
        cleanupFailed = true;
        toast(
          caught instanceof Error
            ? `Media was detached from the prize, but storage cleanup failed: ${caught.message}`
            : "Media was detached from the prize, but storage cleanup failed.",
          "warn",
        );
      }
      await load();
      if (!cleanupFailed) toast("Prize media removed");
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not remove prize media.", "error");
    }
  };

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Rewards</p>
        <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Prize awards</h1>
        <p className="mt-1 text-[12.5px] text-white/45">
          Manually select a prize and customer ID. No automatic draw is performed.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <form className="glass rounded-3xl p-5" onSubmit={(event) => void savePrize(event)}>
          <h2 className="text-[15px]">Add a prize or voucher</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="prize-title">Title</label>
              <input id="prize-title" className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </div>
            <div>
              <label className="label" htmlFor="prize-type">Type</label>
              <select id="prize-type" className="field" value={form.prizeType} onChange={(event) => setForm({ ...form, prizeType: event.target.value })}>
                {["regular", "bumper", "mega", "consolation", "voucher"].map((type) => <option key={type} value={type} className="bg-ink-900">{type}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="prize-worth">Value (₹)</label>
              <input id="prize-worth" className="field" type="number" min="0" step="0.01" value={form.worth} onChange={(event) => setForm({ ...form, worth: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="prize-quantity">Available quantity</label>
              <input id="prize-quantity" className="field" type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="prize-sponsor">Partner / sponsor</label>
              <input id="prize-sponsor" className="field" value={form.sponsor} onChange={(event) => setForm({ ...form, sponsor: event.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="prize-cycle">Campaign / period</label>
              <input id="prize-cycle" className="field" value={form.cycle} onChange={(event) => setForm({ ...form, cycle: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="voucher-code">Voucher code (optional)</label>
              <input id="voucher-code" className="field" value={form.voucherCode} onChange={(event) => setForm({ ...form, voucherCode: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="prize-description">Description</label>
              <textarea id="prize-description" className="field min-h-20" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Add prize
          </button>
        </form>

        <div className="grid content-start gap-4">
          <div className="glass rounded-3xl p-5">
            <h2 className="text-[15px]">Assign a reward</h2>
            {loading ? (
              <p className="mt-4 flex items-center gap-2 text-[12px] text-white/45">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading customers and prizes…
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="label" htmlFor="award-prize">Prize</label>
                  <select id="award-prize" className="field" value={prizeId} onChange={(event) => setPrizeId(event.target.value)}>
                    {prizes.filter((prize) => prize.status === "open" && prize.active && (prize.availableQuantity ?? prize.quantity) > 0).map((prize) => (
                      <option key={prize.id} value={prize.id} className="bg-ink-900">
                        {prize.title} · {prize.worth > 0 ? inr(prize.worth) : prize.description?.split("·")[0] || "Reward"} · {prize.availableQuantity ?? prize.quantity} left
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="award-customer">Winning customer ID</label>
                  <select id="award-customer" className="field" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                    {customers.map((customer) => (
                      <option key={customer.customerCode} value={customer.customerCode} className="bg-ink-900">
                        {customer.customerCode} · {customer.name} · {customer.city}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10.5px] leading-relaxed text-white/40">
                  {demoMode
                    ? "Demo assignment only. It is stored in this browser; no customer message will be sent."
                    : "When confirmed, the server records the assignment and sends notifications only through configured providers. A missing provider is shown in the history."}
                </p>
                <button type="button" className="btn-primary" disabled={saving || !selectedPrize || !selectedCustomer} onClick={() => void awardPrize()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirm &amp; assign
                </button>
              </div>
            )}
          </div>

          <div className="glass rounded-3xl p-5">
            <h2 className="text-[15px]">Customer message preview</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-[11.5px] leading-relaxed text-white/65">
              {message || "Select an available prize and customer ID to preview the notification."}
            </pre>
          </div>
        </div>
      </div>

      <section className="mt-4">
        <h2 className="mb-3 text-[15px]">Prize inventory</h2>
        {loading ? (
          <div className="glass rounded-3xl p-6 text-[12px] text-white/45">Loading prizes…</div>
        ) : prizes.length === 0 ? (
          <div className="glass rounded-3xl p-6 text-[12px] text-white/45">No prizes or vouchers have been added.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {prizes.map((prize) => (
              <div key={prize.id} className="glass flex items-start justify-between gap-3 rounded-3xl p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Gift className={`h-4 w-4 ${prize.status === "open" ? "text-sun" : "text-mint"}`} />
                    <p className="text-[13.5px] font-semibold text-white">{prize.title}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    {prize.sponsor || "No partner"} · {prize.cycle || "No campaign"} · {prize.worth > 0 ? inr(prize.worth) : prize.description || "Reward"}
                  </p>
                  <p className="mt-1 text-[10px] text-white/35">
                    {prize.availableQuantity ?? prize.quantity} of {prize.quantity} available
                  </p>
                  {prize.awardedTo && (
                    <p className="mt-2 font-mono text-[11px] text-violet-200/80">
                      {prize.awardedTo} · {prize.awardedToName} {prize.awardedAt ? `· ${shortDate(prize.awardedAt)}` : ""}
                    </p>
                  )}
                  {prize.mediaUrls && prize.mediaUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {prize.mediaUrls.map((url) => (
                        <div key={url} className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1">
                          <a href={url} target="_blank" rel="noreferrer" className="max-w-[180px] truncate text-[10px] text-violet-200 hover:text-white">
                            View media
                          </a>
                          <button type="button" className="text-[10px] text-coral" onClick={() => void removePrizeMedia(prize, url)}>
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-[10.5px] text-white/55 hover:text-white">
                    {uploadingMediaFor === prize.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Upload collection photo/video
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,video/quicktime"
                      className="sr-only"
                      disabled={uploadingMediaFor !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void attachMedia(prize, file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {prize.status !== "open" && (
                    <button type="button" className="btn-glass mt-3 !py-1.5 !text-[11px]" disabled={saving} onClick={() => void releasePrize(prize)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Release
                    </button>
                  )}
                </div>
                <span className="shrink-0 rounded-full border border-white/15 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/60">
                  {prize.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-3 text-[15px]">Assignment history</h2>
        <div className="glass overflow-x-auto rounded-3xl">
          {assignments.length === 0 ? (
            <p className="p-5 text-[12px] text-white/40">No prizes have been assigned yet.</p>
          ) : (
            <table className="w-full min-w-[700px] text-left text-[11.5px]">
              <thead>
                <tr className="border-b border-white/8 text-[9px] uppercase tracking-[0.14em] text-white/35">
                  <th className="px-5 py-3">Prize</th><th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Assigned</th><th className="px-5 py-3">Notification</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-white/5 last:border-0">
                    <td className="px-5 py-3 text-white/75">{assignment.prizeTitle}</td>
                    <td className="px-5 py-3"><span className="font-mono text-violet-200/80">{assignment.customerId}</span><span className="ml-2 text-white/45">{assignment.customerName}</span></td>
                    <td className="px-5 py-3 text-white/45">{shortDate(assignment.assignedAt)}</td>
                    <td className="px-5 py-3 text-white/55">
                      <span className="capitalize">{assignment.notificationStatus}</span>
                      {assignment.releasedAt && <span className="ml-2 text-white/35">· released {shortDate(assignment.releasedAt)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
