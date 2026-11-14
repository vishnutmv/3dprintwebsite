/**
 * Minimal sun/moon switch. The knob slides between the icons and a full-screen
 * veil animates like a sunrise (light) or sunset (dark) while the theme swaps.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/format";

const SWITCH_AT_MS = 340;
const VEIL_MS = 900;

export function ThemeToggle({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const theme = useTheme((state) => state.theme);
  const setTheme = useTheme((state) => state.setTheme);
  const [transition, setTransition] = useState<Theme | null>(null);
  const visualTheme = transition ?? theme;
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const changeTheme = (next: Theme) => {
    if (transition || next === theme) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setTheme(next);
      return;
    }
    setTransition(next);
    timers.current.push(window.setTimeout(() => setTheme(next), SWITCH_AT_MS));
    timers.current.push(window.setTimeout(() => setTransition(null), VEIL_MS));
  };

  return (
    <>
      <div
        role="group"
        aria-label="Colour theme"
        className={cn("theme-switch", visualTheme === "dark" && "theme-switch-dark", className)}
      >
        <button
          type="button"
          className="theme-switch-half"
          onClick={() => changeTheme("light")}
          aria-label="Day mode"
          aria-pressed={visualTheme === "light"}
          title="Day mode"
        />
        <button
          type="button"
          className="theme-switch-half"
          onClick={() => changeTheme("dark")}
          aria-label="Night mode"
          aria-pressed={visualTheme === "dark"}
          title="Night mode"
        />
        <span className="theme-switch-icon theme-switch-sun" aria-hidden>
          <Sun className="h-3.5 w-3.5" />
        </span>
        <span className="theme-switch-icon theme-switch-moon" aria-hidden>
          <Moon className="h-3.5 w-3.5" />
        </span>
        <span className="theme-switch-thumb" aria-hidden />
      </div>
      {showLabel && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          {visualTheme === "dark" ? "Night" : "Day"}
        </span>
      )}
      {transition && typeof document !== "undefined" && createPortal(
        <div
          aria-hidden
          className={cn("theme-veil", transition === "dark" ? "theme-veil-set" : "theme-veil-rise")}
        >
          <span className="theme-orb" />
        </div>,
        document.body,
      )}
    </>
  );
}
