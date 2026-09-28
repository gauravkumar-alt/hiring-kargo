import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// No generated Database types for this project, so the client is typed loosely.
let cached: SupabaseClient<any, "public", any> | null = null;

export const CV_BUCKET = "kargo-cvs";

function url() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function supabaseConfigured() {
  return Boolean(url() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Server-only client using the service-role key. The browser never talks to Supabase directly. */
export function supabaseAdmin(): SupabaseClient<any, "public", any> {
  if (cached) return cached;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url() || !serviceKey) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }
  cached = createClient<any, "public", any>(url()!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
