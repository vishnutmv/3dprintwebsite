import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { dateTime } from "@/lib/format";
import { useToast } from "@/lib/toast";
import {
  createCampaign,
  getCampaignAudience,
  getCampaigns,
  sendCampaignBatch,
  type AdminCampaign,
} from "@/lib/admin";

type AudienceCustomer = { customerCode: string; name: string; email: string; phone: string };

export function AdminCampaigns() {
  const toast = useToast((state) => state.push);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AudienceCustomer[]>([]);
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [audienceData, campaignData] = await Promise.all([getCampaignAudience(), getCampaigns()]);
      setAudience(audienceData.customers);
      setCampaigns(campaignData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load campaign data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const campaign = await createCampaign(message);
      setActiveCampaign(campaign.id);
      setMessage("");
      await load();
      toast(`Campaign saved for ${campaign.recipientCount} opted-in customers.`);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not create campaign.", "error");
    } finally {
      setSending(false);
    }
  };

  const sendNextBatch = async (id: string) => {
    setSending(true);
    setActiveCampaign(id);
    try {
      const result = await sendCampaignBatch(id);
      await load();
      toast(
        `Batch processed: ${result.processed}. Campaign accepted total: ${result.sentCount}. Failed total: ${result.failedCount}.`,
        result.failedCount > 0 ? "warn" : "success",
      );
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Campaign batch failed.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">WhatsApp</p>
        <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">Opt-in campaigns</h1>
        <p className="mt-1 text-[12.5px] text-white/45">
          Only customers who opted in at checkout are included. Messages are text-only and sent in batches of 3.
        </p>
      </div>

      {error && <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={(event) => void startCampaign(event)} className="glass rounded-3xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/85">Create a text message</p>
              <p className="mt-1 text-[11px] text-white/40">Keep it relevant, identify your business, and include an opt-out instruction such as “Reply STOP”.</p>
            </div>
            <MessageCircle className="h-5 w-5 text-mint" />
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={1000}
            rows={6}
            className="field resize-y"
            placeholder="Hi! 3D Print Co. has an update for you..."
            aria-label="Campaign message"
          />
          <div className="mt-2 flex items-center justify-between text-[10.5px] text-white/35">
            <span>{audience.length} opted-in customers with a mobile number</span>
            <span>{message.length}/1000</span>
          </div>
          <button type="submit" disabled={sending || loading || !message.trim() || audience.length === 0} className="btn-primary mt-4">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Save campaign
          </button>
          <p className="mt-3 text-[10.5px] leading-relaxed text-white/35">
            Saving does not send anything. Start each 20-person batch explicitly below. Failed recipients are not retried automatically.
          </p>
        </form>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-white/85">Customers who agreed</h2>
          <p className="mt-1 text-[11px] text-white/40">{audience.length} contacts are eligible for marketing messages.</p>
          <div className="mt-4 max-h-[360px] overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <p className="py-6 text-center text-xs text-white/40"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Loading audience…</p>
            ) : audience.length === 0 ? (
              <p className="py-6 text-center text-xs text-white/40">No opted-in contacts with a number yet.</p>
            ) : audience.map((customer) => (
              <div key={customer.customerCode} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-white/80">{customer.name}</p>
                  <p className="font-mono text-[10px] text-white/35">{customer.customerCode}</p>
                </div>
                <a className="shrink-0 text-[11px] text-mint/80" href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  {customer.phone}
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass mt-4 overflow-hidden rounded-3xl">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-sm font-semibold text-white/85">Campaign history</h2>
        </div>
        <div className="divide-y divide-white/5">
          {campaigns.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-white/40">No campaigns created yet.</p>
          ) : campaigns.map((campaign) => {
            const remaining = Math.max(0, campaign.recipientCount - campaign.sentCount - campaign.failedCount - campaign.skippedCount);
            return (
              <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[12px] text-white/80">{campaign.message}</p>
                  <p className="mt-1 text-[10.5px] text-white/35">{dateTime(campaign.createdAt)} · {campaign.recipientCount} eligible</p>
                  <p className="mt-1 text-[10.5px] text-white/50">Accepted: {campaign.sentCount} · Failed: {campaign.failedCount} · Skipped: {campaign.skippedCount} · Remaining: {remaining}</p>
                </div>
                {remaining > 0 && (
                  <button type="button" disabled={sending} onClick={() => void sendNextBatch(campaign.id)} className="btn-glass shrink-0">
                    {sending && activeCampaign === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send next 3
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
