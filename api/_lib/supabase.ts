/**
 * Service-role Supabase client. This module must only ever be imported from
 * /api routes — never from src/ — so the service role key is never bundled.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;
  const { url, serviceRoleKey } = supabaseEnv();
  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

export function publicStorageUrl(bucket: string, path: string): string {
  const { url } = supabaseEnv();
  return `${url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}
