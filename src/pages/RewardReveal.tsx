import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Gift, Loader2, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { inr } from "@/lib/format";

type Reward = {
  revealed: boolean;
  title?: string;
  description?: string;
  worth?: number;
  prizeType?: string;
  sponsor?: string;
  voucherCode?: string | null;
};

export function RewardReveal() {
  const { token = "" } = useParams<{ token: string }>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const scratching = useRef(false);
  const strokes = useRef(0);
  const [reward, setReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<Reward>(`/api/rewards/reveal?token=${encodeURIComponent(token)}`);
      if (result.revealed) setReward(result);
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
      const result = await apiPost<Reward>("/api/rewards/reveal", { token });
      if (!result.revealed) throw new Error("The reward could not be revealed. Please try again.");
      setReward(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reward could not be revealed.");
    } finally {
      setRevealing(false);
    }
  }, [revealing, reward, token]);

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
      if (clear / samples >= 0.4) {
        scratching.current = false;
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
          <div className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/[0.06] p-5 text-left">
            <p className="text-xl font-semibold text-white">{reward.title}</p>
            {reward.description && <p className="mt-2 text-sm leading-relaxed text-white/65">{reward.description}</p>}
            {typeof reward.worth === "number" && <p className="mt-3 text-sm text-mint">Prize value: {inr(reward.worth)}</p>}
            {reward.sponsor && <p className="mt-1 text-xs text-white/45">Sponsored by {reward.sponsor}</p>}
            {reward.voucherCode && (
              <div className="mt-5 rounded-xl border border-dashed border-white/20 bg-black/20 p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Voucher code</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wider text-white">{reward.voucherCode}</p>
              </div>
            )}
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
            <button type="button" onClick={() => void reveal()} disabled={revealing} className="btn-primary mx-auto mt-5">
              {revealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {revealing ? "Revealing…" : "Tap to reveal"}
            </button>
          </>
        )}
        {error && <p className="mt-4 rounded-xl border border-coral/25 bg-coral/[0.08] px-3 py-2 text-xs text-coral">{error}</p>}
      </div>
    </div>
  );
}
