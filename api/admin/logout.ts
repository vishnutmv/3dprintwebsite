import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearAdminSessionCookie, isSameOrigin } from "../_lib/auth";
import { fail } from "../_lib/http";
import { json, methodNotAllowed } from "../_lib/http";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  if (!isSameOrigin(req)) {
    fail(res, 403, "A same-origin admin request is required.");
    return;
  }
  clearAdminSessionCookie(res);
  res.setHeader("cache-control", "no-store");
  json(res, 200, { ok: true });
}
