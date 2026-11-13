import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { dateTime, parseDateTime } from "@/lib/format";
import { getLeads, updateLeadStatus, type AdminLead } from "@/lib/admin";
import { useToast } from "@/lib/toast";
import { WhatsAppChat } from "./WhatsAppChat";

type LeadFilter = "all" | AdminLead["status"];
type ChatFilter = "all" | "business";

const FIVE_MINUTES = 5 * 60_000;

/** True when the customer's latest message has gone unanswered for 5+ minutes. */
function unansweredOverFiveMinutes(lead: AdminLead, now: number): boolean {
  return Boolean(
    lead.awaitingAdminSince
    && parseDateTime(lead.awaitingAdminSince).getTime() + FIVE_MINUTES <= now,
  );
}

export function AdminLeads() {
  const toast = useToast((state) => state.push);
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [chatFilter, setChatFilter] = useState<ChatFilter>("business");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const result = await getLeads();
      setLeads(result.leads);
      setNewCount(result.newCount);
      setOverdueCount(result.overdueCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load WhatsApp enquiries.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = window.setInterval(() => void load(true), 15_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [load]);

  const filteredLeads = useMemo(
    () => leads.filter((lead) =>
      (chatFilter === "all" || lead.isBusinessEnquiry)
      && (filter === "all" || lead.status === filter),
    ),
    [chatFilter, filter, leads],
  );

  const changeStatus = async (lead: AdminLead, status: AdminLead["status"]) => {
    setSavingId(lead.id);
    try {
      await updateLeadStatus(lead.id, status);
      toast(status === "active" ? "You are handling this enquiry" : status === "closed" ? "Enquiry closed" : "Enquiry reopened");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not update enquiry.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">CRM</p>
          <h1 className="mt-1.5 text-[clamp(24px,3vw,30px)]">WhatsApp inbox</h1>
          <p className="mt-1 text-[12.5px] text-white/45">
            {newCount} new · {overdueCount} unanswered for over 5 minutes
          </p>
        </div>
        <button type="button" className="btn-glass" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/[0.08] px-3 py-2 text-[11.5px] text-coral">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {([
          ["business", "Business enquiries"],
          ["all", "All chats"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
              chatFilter === value ? "border-mint/35 bg-mint/10 text-mint" : "border-white/10 text-white/50 hover:text-white"
            }`}
            onClick={() => setChatFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "new", "active", "closed"] as const).map((status) => (
          <button
            key={status}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-[11px] capitalize transition ${
              filter === status ? "border-violet-300/40 bg-violet-400/15 text-white" : "border-white/10 text-white/50 hover:text-white"
            }`}
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "All statuses" : status}
            {status === "new" && newCount > 0 ? ` · ${newCount}` : ""}
          </button>
        ))}
      </div>

      {loading && leads.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-[12px] text-white/45">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" /> Loading enquiries…
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-[12px] text-white/45">
          {chatFilter === "business" && !leads.some((lead) => lead.isBusinessEnquiry)
            ? "No business enquiries yet. Regular chats are visible under All chats."
            : filteredLeads.length === 0
              ? "No chats match this status."
              : "No WhatsApp chats yet."}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredLeads.map((lead) => (
            <article
              key={lead.id}
              className={`glass rounded-3xl p-5 ${
                unansweredOverFiveMinutes(lead, now)
                  ? "animate-pulse border border-coral/60 shadow-[0_0_24px_rgba(248,113,113,.12)]"
                  : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-mint" />
                    <h2 className="text-[14px] font-semibold text-white">
                      {lead.name || "WhatsApp customer"}
                    </h2>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                      lead.status === "new"
                        ? "border-sun/30 bg-sun/[0.08] text-sun"
                        : "border-white/15 text-white/50"
                    }`}>
                      {lead.status}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${
                      lead.isBusinessEnquiry
                        ? "border-mint/30 bg-mint/[0.08] text-mint"
                        : "border-white/10 text-white/40"
                    }`}>
                      {lead.isBusinessEnquiry ? "business enquiry" : "chat · no auto-reply"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-white/45">{lead.phone.startsWith("+") || lead.phone.endsWith("@lid") ? lead.phone : `+${lead.phone}`}</p>
                  {lead.customer && (
                    <p className="mt-1 text-[10.5px] leading-relaxed text-white/40">
                      Customer {lead.customer.customerCode} · {lead.customer.email || "No email"} ·{" "}
                      {[lead.customer.address, lead.customer.city, lead.customer.state, lead.customer.postalCode].filter(Boolean).join(", ")}
                      {lead.customer.marketingOptIn ? " · marketing consent on file" : ""}
                    </p>
                  )}
                  {lead.isExistingCustomer && (
                    <p className="mt-1 text-[10.5px] font-medium text-mint">
                      Existing customer · excluded from new lead conversions
                    </p>
                  )}
                </div>
                <p className="text-[10.5px] text-white/35">{dateTime(lead.lastMessageAt)}</p>
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words rounded-2xl border border-white/8 bg-black/20 p-3 text-[12px] leading-relaxed text-white/70">
                {lead.lastMessage}
              </p>
              {lead.isBusinessEnquiry && (
                <div className="mt-3 rounded-xl border border-mint/10 bg-mint/[0.04] px-3 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-mint/70">Enquiry details</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-white/65">
                    {lead.enquiryInterest || "Interest not yet provided"}
                  </p>
                  {lead.detailsRequestedAt && (
                    <p className="mt-1 text-[9.5px] text-white/35">
                      Details requested {dateTime(lead.detailsRequestedAt)}
                    </p>
                  )}
                </div>
              )}

              <p className="mt-2 text-[10px] text-white/35">
                Latest activity {dateTime(lead.lastMessageAt)}
              </p>
              {unansweredOverFiveMinutes(lead, now) && (
                <p className="mt-2 inline-flex rounded-full border border-coral/35 bg-coral/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-coral">
                  Unanswered by the team for over 5 minutes · automated reply sent
                </p>
              )}

              <WhatsAppChat chatId={lead.chatId} phone={lead.phone} name={lead.name} />

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {lead.chatUrl ? (
                  <a className="btn-primary !py-2 !text-[11px]" href={lead.chatUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open WhatsApp chat
                  </a>
                ) : (
                  <span className="text-[10.5px] text-white/40">This contact uses a private WhatsApp chat ID.</span>
                )}
                {lead.status === "new" ? (
                  <button type="button" className="btn-glass !py-2 !text-[11px]" disabled={savingId === lead.id} onClick={() => void changeStatus(lead, "active")}>
                    {savingId === lead.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Take over
                  </button>
                ) : lead.status === "active" ? (
                  <button type="button" className="btn-glass !py-2 !text-[11px]" disabled={savingId === lead.id} onClick={() => void changeStatus(lead, "closed")}>
                    {savingId === lead.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Mark closed
                  </button>
                ) : (
                  <button type="button" className="btn-glass !py-2 !text-[11px]" disabled={savingId === lead.id} onClick={() => void changeStatus(lead, "new")}>
                    {savingId === lead.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Reopen
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
