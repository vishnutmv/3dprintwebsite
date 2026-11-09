/**
 * GET /api/admin/session — validates the HttpOnly admin session cookie.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, methodNotAllowed } from "../_lib/http";
import { requireAdmin } from "../_lib/auth";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }
  const session = requireAdmin(req, res);
  if (!session) return;
  json(res, 200, { admin: { email: session.email, expiresAt: session.exp } });
}
