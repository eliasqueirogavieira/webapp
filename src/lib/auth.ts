import { createClient } from "@/lib/supabase/server";

/**
 * Returns the current user if signed in, else null.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Returns true if the signed-in user is the owner (i.e. has a row in owner_config).
 * `is_owner()` SQL function + owner_config RLS policy make this work: only the owner
 * can read their own row, everyone else gets nothing.
 */
export async function isOwner() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("owner_config")
    .select("user_id")
    .limit(1)
    .maybeSingle();
  return !!data;
}
