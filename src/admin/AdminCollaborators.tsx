import { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Handshake, Loader2, Plus, Save } from "lucide-react";
import {
  createCollaborator,
  createCollaboratorOffer,
  getCollaborators,
  getPrizes,
  updateCollaborator,
  updateCollaboratorOffer,
  type AdminCollaborator,
  type AdminCollaboratorOffer,
  type AdminPrize,
} from "@/lib/admin";
import { inr, shortDate } from "@/lib/format";
import { useToast } from "@/lib/toast";

type CollaboratorForm = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  notes: string;
};

type OfferForm = {
  rewardName: string;
  rewardType: AdminCollaboratorOffer["rewardType"];
  rewardValue: string;
  quantity: string;
  terms: string;
};

const emptyCollaborator: CollaboratorForm = { name: "", contactName: "", email: "", phone: "", notes: "" };
const emptyOffer: OfferForm = { rewardName: "", rewardType: "cashback", rewardValue: "0", quantity: "1", terms: "" };

function offerValueLabel(offer: Pick<AdminCollaboratorOffer, "rewardType" | "rewardValue">): string {
  if (offer.rewardType === "percentage_discount") return `${offer.rewardValue}%`;
  if (offer.rewardType === "cashback" || offer.rewardType === "fixed_discount") return inr(Math.round(offer.rewardValue * 100));
  return "Product / other";
}

export function AdminCollaborators() {
  const toast = useToast((state) => state.push);
  const [collaborators, setCollaborators] = useState<AdminCollaborator[]>([]);
  const [prizes, setPrizes] = useState<AdminPrize[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [collaboratorForm, setCollaboratorForm] = useState(emptyCollaborator);
  const [offerForm, setOfferForm] = useState(emptyOffer);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = collaborators.find((item) => item.id === selectedId) ?? null;
  const selectedOffer = selected?.offers.find((offer) => offer.id === editingOfferId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [collaboratorRows, prizeData] = await Promise.all([getCollaborators(), getPrizes()]);
      setCollaborators(collaboratorRows);
      setPrizes(prizeData.prizes);
      setSelectedId((current) => current && collaboratorRows.some((row) => row.id === current) ? current : collaboratorRows[0]?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load collaborators and rewards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected) {
      setCollaboratorForm(emptyCollaborator);
      return;
    }
    setCollaboratorForm({
      name: selected.name,
      contactName: selected.contactName,
      email: selected.email,
      phone: selected.phone,
      notes: selected.notes,
    });
  }, [selectedId, selected?.id]);

  useEffect(() => {
    if (!selectedOffer) {
      setOfferForm(emptyOffer);
      return;
    }
    setOfferForm({
      rewardName: selectedOffer.rewardName,
      rewardType: selectedOffer.rewardType,
      rewardValue: String(selectedOffer.rewardValue),
      quantity: String(selectedOffer.quantity),
      terms: selectedOffer.terms,
    });
  }, [selectedOffer?.id]);

  const giftCards = useMemo(() => prizes.filter((prize) => prize.active), [prizes]);

  const saveCollaborator = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (selected) {
        await updateCollaborator(selected.id, collaboratorForm);
        toast("Collaborator details updated");
      } else {
        const created = await createCollaborator(collaboratorForm);
        setSelectedId(created.id);
        toast("Collaborator added");
      }
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not save collaborator.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleCollaborator = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateCollaborator(selected.id, { active: !selected.active });
      toast(selected.active ? "Collaborator deactivated" : "Collaborator activated");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not update collaborator.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const quantity = Number(offerForm.quantity);
    const rewardValue = Number(offerForm.rewardValue);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(rewardValue) || rewardValue < 0) {
      toast("Enter a valid reward value and quantity.", "warn");
      return;
    }
    setSaving(true);
    try {
      const input = {
        rewardName: offerForm.rewardName,
        rewardType: offerForm.rewardType,
        rewardValue,
        quantity,
        terms: offerForm.terms,
      };
      if (editingOfferId) await updateCollaboratorOffer(editingOfferId, input);
      else await createCollaboratorOffer(selected.id, input);
      setEditingOfferId(null);
      setOfferForm(emptyOffer);
      toast(editingOfferId ? "Gift-card offer updated" : "Gift-card offer added to prize inventory");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not save gift-card offer.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Rewards network</p>
        <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Collaborators</h1>
        <p className="mt-1 text-[12.5px] text-white/45">
          Maintain partner offers and issue them through the same one-time scratch-card prize flow.
        </p>
      </div>
      {error && <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="glass rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px]">Partner directory</h2>
              <p className="mt-1 text-[10.5px] text-white/40">Contact details and reward commitments.</p>
            </div>
            <button type="button" className="btn-glass !py-2 !text-[10.5px]" onClick={() => { setSelectedId(""); setEditingOfferId(null); }}>
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          {loading ? <p className="flex items-center gap-2 text-[12px] text-white/45"><Loader2 className="h-4 w-4 animate-spin" /> Loading partners…</p> : (
            <div className="mb-4 grid gap-2">
              {collaborators.map((item) => (
                <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setEditingOfferId(null); }}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left ${selectedId === item.id ? "border-violet-300/30 bg-violet-300/[0.08]" : "border-white/8 bg-black/10 hover:bg-white/[0.04]"}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-white">{item.name}</span>
                    <span className="mt-1 block text-[10px] text-white/40">{item.offers.length} offers · {item.active ? "Active" : "Inactive"}</span>
                  </span>
                  <Handshake className="h-4 w-4 shrink-0 text-violet-200" />
                </button>
              ))}
              {collaborators.length === 0 && <p className="rounded-xl border border-white/8 p-3 text-[11px] text-white/40">No collaborators added yet.</p>}
            </div>
          )}

          <form onSubmit={(event) => void saveCollaborator(event)} className="grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2">
            <h3 className="text-[12px] font-semibold text-white sm:col-span-2">{selected ? "Edit collaborator" : "Add collaborator"}</h3>
            <label className="text-[10.5px] text-white/50">Business / partner name
              <input className="field mt-1" value={collaboratorForm.name} onChange={(event) => setCollaboratorForm({ ...collaboratorForm, name: event.target.value })} required minLength={2} maxLength={160} />
            </label>
            <label className="text-[10.5px] text-white/50">Contact person
              <input className="field mt-1" value={collaboratorForm.contactName} onChange={(event) => setCollaboratorForm({ ...collaboratorForm, contactName: event.target.value })} maxLength={120} />
            </label>
            <label className="text-[10.5px] text-white/50">Email
              <input className="field mt-1" type="email" value={collaboratorForm.email} onChange={(event) => setCollaboratorForm({ ...collaboratorForm, email: event.target.value })} />
            </label>
            <label className="text-[10.5px] text-white/50">Phone
              <input className="field mt-1" value={collaboratorForm.phone} onChange={(event) => setCollaboratorForm({ ...collaboratorForm, phone: event.target.value })} maxLength={24} />
            </label>
            <label className="text-[10.5px] text-white/50 sm:col-span-2">Notes
              <textarea className="field mt-1 min-h-16" value={collaboratorForm.notes} onChange={(event) => setCollaboratorForm({ ...collaboratorForm, notes: event.target.value })} maxLength={1000} />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className="btn-primary !py-2.5 !text-[11px]" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {selected ? "Save partner" : "Add partner"}
              </button>
              {selected && <button type="button" className="btn-glass !py-2.5 !text-[11px]" onClick={() => void toggleCollaborator()} disabled={saving}>{selected.active ? "Deactivate" : "Activate"}</button>}
            </div>
          </form>
        </section>

        <section className="grid content-start gap-4">
          <form className="glass rounded-3xl p-5" onSubmit={(event) => void saveOffer(event)}>
            <div className="mb-4 flex items-center gap-2">
              <Gift className="h-4 w-4 text-sun" />
              <div>
                <h2 className="text-[15px]">{editingOfferId ? "Edit partner offer" : "Create gift-card offer"}</h2>
                <p className="mt-1 text-[10.5px] text-white/40">{selected ? `Offer for ${selected.name}` : "Choose or create a collaborator first."}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[10.5px] text-white/50 sm:col-span-2">Reward name
                <input className="field mt-1" value={offerForm.rewardName} onChange={(event) => setOfferForm({ ...offerForm, rewardName: event.target.value })} required minLength={2} maxLength={160} disabled={!selected || !selected.active} />
              </label>
              <label className="text-[10.5px] text-white/50">Reward type
                <select className="field mt-1" value={offerForm.rewardType} onChange={(event) => setOfferForm({ ...offerForm, rewardType: event.target.value as OfferForm["rewardType"] })} disabled={!selected || !selected.active}>
                  <option value="cashback">Cashback (INR)</option>
                  <option value="percentage_discount">Percentage discount</option>
                  <option value="fixed_discount">Fixed discount (INR)</option>
                  <option value="product">Product reward</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-[10.5px] text-white/50">Value
                <input className="field mt-1" type="number" min="0" max={offerForm.rewardType === "percentage_discount" ? "100" : undefined} step="0.01" value={offerForm.rewardValue} onChange={(event) => setOfferForm({ ...offerForm, rewardValue: event.target.value })} disabled={!selected || !selected.active} />
              </label>
              <label className="text-[10.5px] text-white/50">Quantity
                <input className="field mt-1" type="number" min="1" step="1" value={offerForm.quantity} onChange={(event) => setOfferForm({ ...offerForm, quantity: event.target.value })} disabled={!selected || !selected.active} />
              </label>
              <label className="text-[10.5px] text-white/50 sm:col-span-2">Terms / customer instructions
                <textarea className="field mt-1 min-h-16" value={offerForm.terms} onChange={(event) => setOfferForm({ ...offerForm, terms: event.target.value })} maxLength={1000} disabled={!selected || !selected.active} />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="btn-primary !py-2.5 !text-[11px]" disabled={saving || !selected || !selected.active}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingOfferId ? "Save offer" : "Add offer to prize inventory"}
              </button>
              {editingOfferId && <button type="button" className="btn-glass !py-2.5 !text-[11px]" onClick={() => { setEditingOfferId(null); setOfferForm(emptyOffer); }}>Cancel</button>}
            </div>
          </form>

          <div className="glass rounded-3xl p-5">
            <h2 className="text-[15px]">Collaborator gift cards</h2>
            <p className="mt-1 text-[10.5px] text-white/40">All active rewards, including those created in Prizes, are stored in the shared prize inventory.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {giftCards.map((prize) => {
                const offer = collaborators.flatMap((item) => item.offers).find((item) => item.prizeId === prize.id);
                return (
                  <article key={prize.id} className="relative overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-500/15 via-ink-900 to-mint/10 p-4">
                    <div className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-violet-300/10 blur-2xl" />
                    <p className="relative text-[9px] font-bold uppercase tracking-[0.16em] text-violet-200/70">{prize.sponsor || "3D Print Co."} · hidden reward card</p>
                    <h3 className="relative mt-2 text-[13px] font-semibold text-white">{prize.title}</h3>
                    <p className="relative mt-1 text-[10px] text-white/45">Scratch to reveal · {prize.availableQuantity ?? prize.quantity} of {prize.quantity} available</p>
                    {offer && <p className="relative mt-2 text-[10px] text-mint">{offer.rewardType.replace(/_/g, " ")} · {offerValueLabel(offer)}</p>}
                    <div className="relative mt-3 flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-[9px] text-white/35">{shortDate(prize.createdAt ?? "")}</span>
                      {offer && <button type="button" className="text-[9px] font-semibold text-violet-200 hover:text-white" onClick={() => { setSelectedId(offer.collaboratorId); setEditingOfferId(offer.id); }}>Edit offer</button>}
                    </div>
                  </article>
                );
              })}
              {giftCards.length === 0 && <p className="text-[11px] text-white/40">No reward cards are available yet. Add one from this page or the Prizes tab.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
