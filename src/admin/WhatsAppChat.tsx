import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { dateTime } from "@/lib/format";
import { getWhatsAppMessages, sendWhatsAppMessage, type WhatsAppMessage } from "@/lib/admin";
import { useToast } from "@/lib/toast";

type Props = {
  name: string;
  phone: string;
  chatId?: string;
};

function getChatId(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) digits = `91${digits.slice(1)}`;
  return /^\d{6,20}$/.test(digits) ? `${digits}@c.us` : "";
}

export function WhatsAppChat({ name, phone, chatId: suppliedChatId }: Props) {
  const toast = useToast((state) => state.push);
  const chatId = suppliedChatId || getChatId(phone);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!chatId) return;
    try {
      const result = await getWhatsAppMessages(chatId);
      setMessages(result);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this conversation.");
    }
  }, [chatId]);

  useEffect(() => {
    if (!open || !chatId) return;
    setLoading(true);
    void load().finally(() => setLoading(false));
    const timer = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(timer);
  }, [load, open, chatId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const digits = phone.replace(/\D/g, "");
      const contactPhone = /^\d{6,20}$/.test(digits) ? digits : undefined;
      await sendWhatsAppMessage({ chatId, name, phone: contactPhone, message });
      setText("");
      await load();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : "Could not send WhatsApp message.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mt-3 rounded-2xl border border-white/10 bg-black/15">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11.5px] font-semibold text-mint"
        onClick={() => setOpen((value) => !value)}
        disabled={!chatId}
      >
        <MessageCircle className="h-4 w-4" />
        {open ? "Close admin chat" : "Chat from admin"}
        {!chatId && <span className="ml-auto text-[10px] font-normal text-white/40">No usable mobile number</span>}
      </button>
      {open && (
        <div className="border-t border-white/8 p-3">
          <div className="max-h-72 min-h-24 space-y-2 overflow-y-auto">
            {loading && messages.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-6 text-[11px] text-white/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading conversation…
              </p>
            ) : messages.length === 0 ? (
              <p className="py-5 text-center text-[11px] text-white/40">
                No saved messages yet. Send a message to start the conversation.
              </p>
            ) : messages.map((message) => (
              <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                  message.direction === "outbound" ? "bg-emerald-500/15 text-emerald-50" : "bg-white/[0.07] text-white/80"
                }`}>
                  <p className="whitespace-pre-wrap break-words text-[11.5px] leading-relaxed">{message.body}</p>
                  <p className="mt-1 text-right text-[9px] text-white/35">{dateTime(message.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="mt-2 text-[10.5px] text-coral">{error}</p>}
          <form className="mt-3 flex items-end gap-2" onSubmit={(event) => void send(event)}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="field min-h-10 resize-y text-[11.5px]"
              placeholder={`Message ${name || "customer"}…`}
              maxLength={4000}
              rows={2}
              aria-label="WhatsApp message"
            />
            <button type="submit" className="btn-primary !px-3 !py-2.5" disabled={!text.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send message</span>
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
