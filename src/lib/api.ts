/**
 * Thin fetch wrapper for /api routes.
 * Normalises paths, parses JSON errors and uses same-origin admin cookies.
 */

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function urlFor(path: string): string {
  return path.startsWith("/api") ? path : `/api${path.startsWith("/") ? "" : "/"}${path}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === "true") {
    if (options.signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");
    try {
      const { demoApiRequest } = await import("./demo");
      return await demoApiRequest<T>(urlFor(path), options.method, options.body);
    } catch (error) {
      if (error instanceof Error && "status" in error) {
        const status = Number((error as Error & { status: number }).status);
        throw new ApiError(error.message, status);
      }
      throw error;
    }
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(urlFor(path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status, payload);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError("The server returned an unexpected response. Check the API deployment.", 502, payload);
  }

  return payload as T;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { signal });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", body });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "DELETE", body });
}
