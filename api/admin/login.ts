/**
 * POST /api/admin/login  { email, password }
 * Credentials are checked only on the server. The signed, expiring session
 * is returned as an HttpOnly cookie rather than exposed to JavaScript.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handleError, json, methodNotAllowed, readJson } from "../_lib/http";
import { enforceRateLimit } from "../_lib/rate-limit";
import { text } from "../_lib/validate";
import {
  checkAdminCredentials,
  isSameOrigin,
  issueAdminToken,
  setAdminSessionCookie,
} from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  if (!isSameOrigin(req)) {
    fail(res, 403, "A same-origin admin request is required.");
    return;
  }
  if (!enforceRateLimit(req, res, "admin-login", 5, 5 * 60_000)) return;

  try {
    const body = await readJson(req);
    const email = text(body.email, 254);
    const password = text(body.password, 200);

    if (!email || !password) {
      fail(res, 400, "Email and password are required.");
      return;
    }

    if (!checkAdminCredentials(email, password)) {
      // Small constant delay to blunt online guessing.
      await new Promise((resolve) => setTimeout(resolve, 350));
      fail(res, 401, "Invalid admin credentials.");
      return;
    }

    const token = issueAdminToken(email.toLowerCase());
    setAdminSessionCookie(res, token.token);
    res.setHeader("cache-control", "no-store");
    json(res, 200, { admin: { email: email.toLowerCase() }, expiresIn: token.expiresIn });
  } catch (error) {
    handleError(res, error, "POST /api/admin/login");
  }
}
