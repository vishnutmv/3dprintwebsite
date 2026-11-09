/**
 * HTTP helpers shared by every Vercel API route.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ConfigError } from "./env";

export function json(res: VercelResponse, status: number, data: unknown): void {
  res.status(status).json(data);
}

export function fail(
  res: VercelResponse,
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
): void {
  res.status(status).json({ error: message, ...extra });
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader("allow", allowed.join(", "));
  fail(res, 405, `Method not allowed. Use ${allowed.join(" / ")}.`);
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value ?? "").split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

export function handleError(res: VercelResponse, error: unknown, context: string): void {
  if (error instanceof ConfigError) {
    fail(res, 503, error.message);
    return;
  }
  console.error(`[api] ${context} failed:`, error);
  fail(res, 500, "Unexpected server error. Please try again.");
}

/** Reads a JSON body from either Vercel's parsed body or the raw stream. */
export async function readJson(req: VercelRequest): Promise<Record<string, unknown>> {
  const body = req.body as unknown;
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) {
    return body as Record<string, unknown>;
  }
  if (typeof body === "string" && body.length > 0) {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  }
  const raw = await readRawBody(req);
  if (raw.length === 0) return {};
  const parsed = JSON.parse(raw.toString("utf8")) as unknown;
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

export async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > 2 * 1024 * 1024) throw new Error("Request body too large.");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/** Last dynamic path segment, e.g. /api/orders/ORD-ABC -> ORD-ABC. */
export function pathParam(req: VercelRequest, key: string): string {
  const value = req.query[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value[0]) return value[0];
  const pathname = (req.url ?? "").split("?")[0] ?? "";
  return decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
}

export function queryString(req: VercelRequest, key: string): string {
  const value = req.query[key];
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value[0]) return value[0].trim();
  return "";
}
