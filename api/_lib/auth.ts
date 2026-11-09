/**
 * Server-side admin authentication.
 *
 * - Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD environment variables
 *   (server only — never shipped in the client bundle).
 * - A successful login stores an HMAC-signed, expiring session in an
 *   HttpOnly, SameSite cookie.
 * - Every /api/admin/* route calls requireAdmin() before doing any work.
 */

import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { adminEnv } from "./env";
import { fail } from "./http";

const TTL_SECONDS = 8 * 60 * 60;
const COOKIE_NAME = "3dp-admin-session";

type TokenPayload = { sub: "admin"; email: string; iat: number; exp: number };

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hmac(message: string, secret: string): string {
  return base64Url(crypto.createHmac("sha256", secret).update(message).digest());
}

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function issueAdminToken(email: string): { token: string; expiresIn: number } {
  const { secret } = adminEnv();
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { sub: "admin", email, iat: now, exp: now + TTL_SECONDS };
  const encoded = base64Url(JSON.stringify(payload));
  return { token: `${encoded}.${hmac(encoded, secret)}`, expiresIn: TTL_SECONDS };
}

export function verifyAdminToken(token: string): TokenPayload | null {
  const { secret } = adminEnv();
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (!safeEqual(hmac(encoded, secret), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as TokenPayload;
    if (payload.sub !== "admin") return null;
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setAdminSessionCookie(res: VercelResponse, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL_SECONDS}${secure}`,
  );
}

export function clearAdminSessionCookie(res: VercelResponse): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
  );
}

function adminTokenFromCookie(req: VercelRequest): string {
  const header = req.headers.cookie;
  const cookie = Array.isArray(header) ? header.join(";") : header ?? "";
  const pair = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return pair?.slice(COOKIE_NAME.length + 1) ?? "";
}

export function isSameOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  const forwardedHost = req.headers["x-forwarded-host"];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost;
  const host = hostHeader ?? req.headers.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function checkAdminCredentials(email: string, password: string): boolean {
  const config = adminEnv();
  const emailOk = safeEqual(sha256(email.trim().toLowerCase()), sha256(config.email.toLowerCase()));
  const passwordOk = safeEqual(sha256(password), sha256(config.password));
  // Evaluate both comparisons so timing does not reveal which field was wrong.
  return emailOk && passwordOk;
}

/** Returns the admin session, or writes a 401/503 response and returns null. */
export function requireAdmin(req: VercelRequest, res: VercelResponse): TokenPayload | null {
  let secretConfigured = true;
  try {
    adminEnv();
  } catch {
    secretConfigured = false;
  }
  if (!secretConfigured) {
    fail(res, 503, "Admin access is not configured on this deployment.");
    return null;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    if (!isSameOrigin(req)) {
      fail(res, 403, "A same-origin admin request is required.");
      return null;
    }
  }

  const token = adminTokenFromCookie(req);
  if (!token) {
    fail(res, 401, "Missing admin session.");
    return null;
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    fail(res, 401, "Admin session is invalid or has expired. Sign in again.");
    return null;
  }
  return payload;
}
