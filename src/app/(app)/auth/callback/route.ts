/**
 * OAuth + magic-link callback.
 *
 * Supabase project setup needed (one-time, in the dashboard):
 *   - Authentication → URL Configuration: Site URL set to the production
 *     origin; Redirect URLs include `https://<vercel-app>/auth/callback`
 *     and `http://localhost:3000/auth/callback` (and whatever PORT you
 *     run dev on).
 *   - Authentication → Providers → Google: enable, paste OAuth client
 *     id/secret from Google Cloud Console.
 *   - Authentication → Providers → Email: enabled by default.
 *
 * Auto-claim flow: the email matching `OWNER_EMAIL` (server env, see
 * .env.example) is allowed to claim ownership the first time it signs
 * in. The upsert is idempotent; subsequent sign-ins are no-ops. Any
 * other email signs in fine but stays a public viewer — no row in
 * `owner_config`, RLS keeps writes blocked.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
    if (ownerEmail) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email && user.email.toLowerCase() === ownerEmail) {
        // Service-role write: owner_config has no INSERT policy for clients,
        // and the table is the single source of truth for is_owner(). Safe
        // because the email check above is gated by the server-only env.
        const admin = createAdminClient();
        await admin
          .from("owner_config")
          .upsert({ user_id: user.id }, { onConflict: "user_id" });
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
