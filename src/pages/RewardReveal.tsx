import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, Gift, Loader2, Share2, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";
import { createRewardCardPdf, type RewardCardDetails } from "@/lib/invoice";

type RewardResponse = {
  revealed: boolean;
  title?: string;
  description?: string;
  worth?: number;
  prizeType?: string;
  sponsor?: string;
  voucherCode?: string | null;
  revealedAt?: string;
};

export function RewardReveal() {
  const { token = "" } = useParams<{ token: string }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const scratching = useRef(false);
  const strokes = useRef(0);
  const [reward, setReward] = useState<RewardCardDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [celebration, setCelebration] = useState(false);

  const saveRewardPdf = useCallback((details: RewardCardDetails) => {
    const pdf = createRewardCardPdf(details);
    const safeTitle = (details.title ?? "reward").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    pdf.save(`3d-print-co-reward-${safeTitle || "card"}.pdf`);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<RewardResponse>(`/api/rewards/reveal?token=${encodeURIComponent(token)}`);
      if (result.revealed && typeof result.title === "string") {
        setReward({
          title: result.title,
          description: result.description,
          worth: result.worth,
          prizeType: result.prizeType,
          sponsor: result.sponsor,
          voucherCode: result.voucherCode,
          revealedAt: result.revealedAt,
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This reward link is not valid.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || reward) return;
    const context = element.getContext("2d");
    if (!context) return;
    const gradient = context.createLinearGradient(0, 0, element.width, element.height);
    gradient.addColorStop(0, "#c4b8db");
    gradient.addColorStop(0.5, "#756783");
    gradient.addColorStop(1, "#b2a1c9");
    context.globalCompositeOperation = "source-over";
    context.fillStyle = gradient;
    context.fillRect(0, 0, element.width, element.height);
    context.fillStyle = "#fff";
    context.font = "bold 28px sans-serif";
    context.textAlign = "center";
    context.fillText("Scratch to reveal your reward", element.width / 2, element.height / 2);
    context.font = "16px sans-serif";
    context.fillText("3D Print Co. surprise", element.width / 2, element.height / 2 + 34);
  }, [reward]);

  const reveal = useCallback(async () => {
    if (revealing || reward || !token) return;
    setRevealing(true);
    setError("");
    try {
      const result = await apiPost<RewardResponse>("/api/rewards/reveal", { token });
      if (!result.revealed || !result.title) throw new Error("The reward could not be revealed. Please try again.");
      const details: RewardCardDetails = {
        title: result.title,
        description: result.description,
        worth: result.worth,
        prizeType: result.prizeType,
        sponsor: result.sponsor,
        voucherCode: result.voucherCode,
        revealedAt: result.revealedAt,
      };
      setReward(details);
      setCelebration(true);
      saveRewardPdf(details);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reward could not be revealed.");
    } finally {
      setRevealing(false);
    }
  }, [revealing, reward, saveRewardPdf, token]);

  const shareReward = useCallback(async () => {
    if (!reward) return;
    setShareStatus("");
    const pdf = createRewardCardPdf(reward);
    const file = new File([pdf.output("blob")], "3d-print-co-reward.pdf", { type: "application/pdf" });
    try {
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        saveRewardPdf(reward);
        setShareStatus("This browser cannot share PDF files directly. The reward PDF has been downloaded.");
        return;
      }
      await navigator.share({ title: "My 3D Print Co. reward", text: "Here is my revealed reward card.", files: [file] });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "The reward card could not be shared.");
    }
  }, [reward, saveRewardPdf]);

  const scratch = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !scratching.current || revealing || reward) return;
    const rect = element.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * element.width / rect.width,
      y: (event.clientY - rect.top) * element.height / rect.height,
    };
    context.globalCompositeOperation = "destination-out";
    context.lineWidth = 58;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    if (lastPoint.current) {
      context.moveTo(lastPoint.current.x, lastPoint.current.y);
    } else {
      context.moveTo(point.x, point.y);
    }
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPoint.current = point;

    strokes.current += 1;
    if (strokes.current % 8 === 0) {
      const pixels = context.getImageData(0, 0, element.width, element.height).data;
      let clear = 0;
      let samples = 0;
      for (let index = 3; index < pixels.length; index += 48) {
        samples += 1;
        if (pixels[index] < 30) clear += 1;
      }
      if (clear / samples >= 0.9) {
        scratching.current = false;
        context.clearRect(0, 0, element.width, element.height);
        void reveal();
      }
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-28">
      <div className="glass overflow-hidden rounded-3xl p-6 text-center sm:p-9">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-400/10 text-violet-200">
          {reward ? <Sparkles className="h-7 w-7" /> : <Gift className="h-7 w-7" />}
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">3D Print Co. reward</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{reward ? "Congratulations!" : "A surprise is waiting"}</h1>
        {loading ? (
          <p className="mt-4 text-sm text-white/45"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Checking reward link…</p>
        ) : reward ? (
          <div className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-violet-200/30 bg-gradient-to-br from-violet-500/25 via-[#171127] to-emerald-500/15 p-6 text-left shadow-[0_0_55px_rgba(167,139,250,0.2)] sm:p-8">
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {celebration && Array.from({ length: 22 }, (_, index) => (
                <span key={index} className={`absolute top-0 h-2 w-1.5 animate-bounce rounded-sm ${index % 3 === 0 ? "bg-mint" : index % 3 === 1 ? "bg-sun" : "bg-violet-200"}`}
                  style={{ left: `${(index * 47 + 9) % 100}%`, animationDelay: `${(index % 7) * 0.12}s`, transform: `rotate(${index * 31}deg)` }} />
              ))}
            </div>
            <div className="relative">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-200/70">{reward.sponsor || "3D Print Co."} reward</p>
              <p className="mt-3 text-2xl font-bold text-white">{reward.title}</p>
              {reward.description && <p className="mt-3 text-sm leading-relaxed text-white/70">{reward.description}</p>}
              {typeof reward.worth === "number" && reward.worth > 0 && <p className="mt-4 text-sm font-semibold text-mint">Reward value: {inr(reward.worth)}</p>}
              {reward.sponsor && <p className="mt-2 text-xs text-white/50">Provided by {reward.sponsor}</p>}
              {reward.voucherCode && (
                <div className="mt-5 rounded-xl border border-dashed border-violet-200/35 bg-black/25 p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/45">Voucher code</p>
                  <p className="mt-1 break-all font-mono text-lg font-bold tracking-wider text-white">{reward.voucherCode}</p>
                </div>
              )}
              <p className="mt-5 border-t border-white/10 pt-3 text-[10px] text-white/45">Revealed once · saved as a reward card</p>
            </div>
            <div className="relative mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn-primary !py-2.5 !text-[11px]" onClick={() => saveRewardPdf(reward)}>
                <Download className="h-4 w-4" /> Download card PDF
              </button>
              <button type="button" className="btn-glass !py-2.5 !text-[11px]" onClick={() => void shareReward()}>
                <Share2 className="h-4 w-4" /> Share reward card
              </button>
            </div>
            {shareStatus && <p className="relative mt-3 text-[10px] text-white/45">{shareStatus}</p>}
          </div>
        ) : (
          <>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/55">Scratch the card below to reveal your reward. The prize details are kept hidden until you reveal it.</p>
            <div className="relative mx-auto mt-6 aspect-[2/1] w-full max-w-[500px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-pink-500/10">
              <div className="absolute inset-0 grid place-items-center px-5 text-lg font-semibold text-violet-100/80">Your reward is inside</div>
              <canvas
                ref={canvas}
                width={640}
                height={320}
                onPointerDown={(event) => {
                  scratching.current = true;
                  lastPoint.current = null;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  scratch(event);
                }}
                onPointerMove={scratch}
                onPointerUp={() => { scratching.current = false; lastPoint.current = null; }}
                onPointerCancel={() => { scratching.current = false; lastPoint.current = null; }}
                className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
                aria-label="Scratch card to reveal your prize"
              />
            </div>
            {revealing && <p className="mt-4 text-[11px] text-violet-200"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Revealing your reward…</p>}
          </>
        )}
        {error && <p className="mt-4 rounded-xl border border-coral/25 bg-coral/[0.08] px-3 py-2 text-xs text-coral">{error}</p>}
      </div>
    </div>
  );
}
