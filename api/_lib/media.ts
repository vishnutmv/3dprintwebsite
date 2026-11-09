import { isHttpUrl } from "./validate";

export function mediaUrls(value: unknown, max = 12): string[] | null {
  if (!Array.isArray(value)) return null;
  const urls = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (urls.length > max) return null;
  if (urls.some((url) => !isHttpUrl(url))) return null;
  return urls;
}
