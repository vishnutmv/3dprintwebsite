/**
 * Supabase Storage bucket rules for admin uploads.
 * Mirrors the buckets created in supabase/migrations/0003_storage.sql.
 */

import path from "node:path";
import { db, publicStorageUrl } from "./supabase";

export type BucketName = "products" | "product-videos" | "prize-media";

type BucketConfig = {
  maxBytes: number;
  mimeTypes: string[];
  label: string;
};

export const BUCKETS: Record<BucketName, BucketConfig> = {
  products: {
    label: "Product images & 3D models",
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "model/gltf-binary",
      "model/gltf+json",
      "application/octet-stream",
    ],
  },
  "product-videos": {
    label: "Product videos",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  },
  "prize-media": {
    label: "Prize media",
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ],
  },
};

export function isBucketName(value: string): value is BucketName {
  return value === "products" || value === "product-videos" || value === "prize-media";
}

export function bucketAllows(bucket: BucketName, mime: string, extension: string): boolean {
  const config = BUCKETS[bucket];
  if (config.mimeTypes.includes(mime)) return true;
  // Browsers sometimes send an empty type for .glb; the server accepts it by extension.
  if (bucket === "products" && /^\.(glb|gltf)$/i.test(extension)) return true;
  return false;
}

export function safePath(filename: string): string {
  const extension = path.extname(filename).toLowerCase().slice(0, 10);
  const base = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${random}-${base}${extension}`;
}

export async function createSignedUpload(bucket: BucketName, filename: string) {
  const storagePath = safePath(filename);
  const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(storagePath);
  if (error || !data) {
    throw new Error(`Could not create signed upload URL: ${error?.message ?? "unknown error"}`);
  }
  return {
    bucket,
    path: data.path,
    token: data.token,
    publicUrl: publicStorageUrl(bucket, data.path),
  };
}

export async function removeObject(bucket: BucketName, objectPath: string): Promise<void> {
  const clean = objectPath.replace(/^\/+/, "");
  if (!clean || clean.includes("..")) throw new Error("Invalid storage path.");
  const { error } = await db().storage.from(bucket).remove([clean]);
  if (error) throw new Error(`Could not delete file: ${error.message}`);
}

/** Only allow deleting objects that live inside one of our known buckets. */
export function objectPathFromPublicUrl(url: string): { bucket: BucketName; path: string } | null {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, bucket, objectPath] = match;
  if (!isBucketName(bucket)) return null;
  return { bucket, path: decodeURIComponent(objectPath) };
}
