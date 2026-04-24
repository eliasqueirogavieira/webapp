import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS — only use server-side, never expose to the browser.
 * Suitable for: import scripts, trusted server actions that verified ownership elsewhere.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
