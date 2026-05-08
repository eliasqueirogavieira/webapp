import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Dev-only auth bypass. When `DEV_AUTH_BYPASS=1` in env (server-only),
 * pretend the request is from a signed-in owner without touching Supabase.
 * Used for Playwright smoke tests so the sidebar/button rendering can be
 * verified without spinning up a real session. Never enable in production.
 */
const DEV_BYPASS = process.env.DEV_AUTH_BYPASS === "1";
const DEV_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "dev@local",
} as unknown as User;

/**
 * Returns the current user if signed in, else null.
 */
export async function getUser() {
  if (DEV_BYPASS) return DEV_USER;
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
  if (DEV_BYPASS) return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("owner_config")
    .select("user_id")
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Idempotent: insert the signed-in user into `owner_config` when their
 * email matches `OWNER_EMAIL`. Called from the layout on every render so
 * a fresh sign-in immediately gets ownership without a separate callback.
 *
 * Safe to call repeatedly — no-op when the user isn't the configured
 * owner, or when they're already in owner_config.
 */
export async function ensureOwnerClaim(): Promise<void> {
  if (DEV_BYPASS) return;
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  if (!ownerEmail) return;
  const user = await getUser();
  if (!user?.email || user.email.toLowerCase() !== ownerEmail) return;
  if (await isOwner()) return;
  const admin = createAdminClient();
  await admin
    .from("owner_config")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
}

/** Server action: clears the SSR cookie session and bounces to home. */
export async function signOut() {
  "use server";
  if (!DEV_BYPASS) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}
