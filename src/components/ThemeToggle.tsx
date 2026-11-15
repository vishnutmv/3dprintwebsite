/**
 * Minimal sun/moon switch. The theme change uses the browser's View Transition
 * API to reveal the new theme from the switch, with a plain CSS fallback.
 */

import { useRef, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/format";

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
};

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const theme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);
  const transitioning = useRef(false);

  const changeTheme = (next: Theme, event: MouseEvent<HTMLButtonElement>) => {
    if (next === theme || transitioning.current) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const doc = document as TransitionDocument;
    const apply = () => flushSync(() => setTheme(next));

    if (!doc.startViewTransition || reduceMotion) {
      apply();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );
    const root = document.documentElement;
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty("--theme-radius", `${radius}px`);
    // Capture the final palette in the new snapshot, not a half-finished CSS
    // colour transition. Transitions resume once the reveal is complete.
    root.classList.add("theme-switching");

    transitioning.current = true;
    try {
      const transition = doc.startViewTransition(apply);
      transition.finished
        .catch(() => undefined)
        .finally(() => {
          transitioning.current = false;
          root.classList.remove("theme-switching");
          root.style.removeProperty("--theme-x");
          root.style.removeProperty("--theme-y");
          root.style.removeProperty("--theme-radius");
        });
    } catch {
      transitioning.current = false;
      root.classList.remove("theme-switching");
      root.style.removeProperty("--theme-x");
      root.style.removeProperty("--theme-y");
      root.style.removeProperty("--theme-radius");
      apply();
    }
  };

  return (
    <>
      <div
        role="group"
        aria-label="Colour theme"
        className={cn("theme-switch", theme === "dark" && "theme-switch-dark", className)}
      >
        <button
          type="button"
          className="theme-switch-half"
          onClick={(event) => changeTheme("light", event)}
          aria-label="Day mode"
          aria-pressed={theme === "light"}
          title="Day mode"
        />
        <button
          type="button"
          className="theme-switch-half"
          onClick={(event) => changeTheme("dark", event)}
          aria-label="Night mode"
          aria-pressed={theme === "dark"}
          title="Night mode"
        />
        <span className="theme-switch-icon theme-switch-sun" aria-hidden="true">
          <Sun className="h-3.5 w-3.5" />
        </span>
        <span className="theme-switch-icon theme-switch-moon" aria-hidden="true">
          <Moon className="h-3.5 w-3.5" />
        </span>
        <span className="theme-switch-thumb" aria-hidden="true" />
      </div>
      {showLabel && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          {theme === "dark" ? "Night" : "Day"}
        </span>
      )}
    </>
  );
}
