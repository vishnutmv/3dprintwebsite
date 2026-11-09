/**
 * POST /api/admin/uploads/sign
 * Body: { bucket, filename, contentType, size }
 *
 * Returns a short-lived signed upload URL so the browser can upload directly
 * to Supabase Storage (bypassing Vercel's request body limit). Only an
 * authenticated admin can obtain one.
 */

import path from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail, handleError, json, methodNotAllowed, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { intInRange, text } from "../../_lib/validate";
import { BUCKETS, bucketAllows, createSignedUpload, isBucketName } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    const body = await readJson(req);
    const bucket = text(body.bucket, 40);
    const filename = text(body.filename, 200);
    const contentType = text(body.contentType, 100).toLowerCase();
    const size = intInRange(body.size, 1, 200 * 1024 * 1024);

    if (!isBucketName(bucket)) {
      fail(res, 400, "Unknown storage bucket.");
      return;
    }
    if (!filename || !size) {
      fail(res, 400, "filename and size are required.");
      return;
    }

    const config = BUCKETS[bucket];
    if (size > config.maxBytes) {
      fail(res, 413, `Keep uploads under ${Math.round(config.maxBytes / (1024 * 1024))} MB.`);
      return;
    }

    const extension = path.extname(filename);
    if (!bucketAllows(bucket, contentType, extension)) {
      fail(res, 415, `That file type is not allowed in ${config.label}.`);
      return;
    }

    const signed = await createSignedUpload(bucket, filename);
    json(res, 201, signed);
  } catch (error) {
    handleError(res, error, "POST /api/admin/uploads/sign");
  }
}
