/**
 * Best-effort fixed-window rate limiting for sensitive endpoints.
 *
 * Vercel serverless instances are short-lived and not shared, so this is
 * abuse friction rather than a hard global guarantee. For stricter limits,
 * swap this for Upstash Redis / Vercel KV behind the same function.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clientIp, fail } from "./http";

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Returns true when the request may proceed. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

/** Returns false when a 429 has already been written. */
export function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  scope: string,
  limit: number,
  windowMs: number,
): boolean {
  if (rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs)) return true;
  res.setHeader("retry-after", String(Math.ceil(windowMs / 1000)));
  fail(res, 429, "Too many requests. Please wait a moment and try again.");
  return false;
}
