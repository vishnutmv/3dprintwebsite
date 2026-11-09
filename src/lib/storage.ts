/**
 * Admin media uploads are proxied through the authenticated PHP API and stored
 * under InterServer's public_html/uploads directory.
 */

import { useAdminAuth } from "./auth";

export type Bucket = "products" | "product-videos" | "prize-media";

export async function uploadMedia(
  bucket: Bucket,
  file: File,
): Promise<{ url: string; path: string }> {
  const form = new FormData();
  form.append("bucket", bucket);
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch("/api/admin/uploads", {
      method: "POST",
      body: form,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("The server returned an unexpected upload response.");
  }
  if (!response.ok) {
    if (response.status === 401) useAdminAuth.getState().clearSession();
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Upload failed (${response.status}).`;
    throw new Error(message);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("url" in payload) ||
    !("path" in payload) ||
    typeof payload.url !== "string" ||
    typeof payload.path !== "string"
  ) {
    throw new Error("The server returned an unexpected upload response.");
  }
  return { url: payload.url, path: payload.path };
}
