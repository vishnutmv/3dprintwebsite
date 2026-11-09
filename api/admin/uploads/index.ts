/**
 * GET    /api/admin/uploads?bucket=products — list stored media
 * DELETE /api/admin/uploads — { bucket, path } or { url }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, publicStorageUrl } from "../../_lib/supabase";
import { fail, handleError, json, methodNotAllowed, queryString, readJson } from "../../_lib/http";
import { requireAdmin } from "../../_lib/auth";
import { intInRange, text } from "../../_lib/validate";
import { isBucketName, removeObject } from "../../_lib/storage";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "DELETE") {
    methodNotAllowed(res, ["GET", "DELETE"]);
    return;
  }
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const bucket = queryString(req, "bucket") || "products";
      if (!isBucketName(bucket)) {
        fail(res, 400, "Unknown storage bucket.");
        return;
      }
      const limit = intInRange(queryString(req, "limit") || 100, 1, 200) ?? 100;

      const { data, error } = await db()
        .storage.from(bucket)
        .list("", { limit, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw new Error(`Could not list media: ${error.message}`);

      json(res, 200, {
        bucket,
        files: (data ?? [])
          .filter((file) => file.name && !file.name.startsWith("."))
          .map((file) => ({
            name: file.name,
            path: file.name,
            size: file.metadata?.size ?? null,
            contentType: file.metadata?.mimetype ?? null,
            createdAt: file.created_at ?? null,
            publicUrl: publicStorageUrl(bucket, file.name),
          })),
      });
      return;
    }

    const body = await readJson(req);
    const bucketValue = text(body.bucket, 40);
    const urlValue = text(body.url, 600);
    let objectPath = text(body.path, 600);

    if (urlValue) {
      const match = urlValue.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (!match || !isBucketName(match[1])) {
        fail(res, 400, "That URL does not point at a managed bucket.");
        return;
      }
      await removeObject(match[1], decodeURIComponent(match[2]));
      json(res, 200, { ok: true });
      return;
    }

    if (!isBucketName(bucketValue) || !objectPath) {
      fail(res, 400, "bucket and path (or url) are required.");
      return;
    }
    objectPath = objectPath.replace(/^\/+/, "");
    await removeObject(bucketValue, objectPath);
    json(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error, "admin/uploads");
  }
}
