/**
 * OAuth + magic-link callback.
 *
 * Supabase project setup needed (one-time, in the dashboard):
 *   - Authentication → URL Configuration: Site URL set to the production
 *     origin; Redirect URLs include `https://<vercel-app>/auth/callback`
 *     and `http://localhost:<port>/auth/callback` (and whatever PORT you
 *     run dev on).
 *   - Authentication → Providers → Google: enable, paste OAuth client
 *     id/secret from Google Cloud Console. In Google Cloud Console set
 *     authorized redirect URI to `https://<project>.supabase.co/auth/v1/callback`.
 *   - Authentication → Providers → Email: enabled by default.
 *
 * Auto-claim: when the signed-in email matches `OWNER_EMAIL` (server env)
 * we upsert the user's UUID into `owner_config` so RLS opens up writes.
 * Idempotent on every sign-in. Any other email signs in fine but stays a
 * public viewer — no row, RLS keeps writes blocked.
 *
 * Cookie wiring: we bind the Supabase client's cookie callbacks to the
 * outgoing NextResponse directly (not to `next/headers` cookies()) so the
 * Set-Cookie headers ride the redirect. The companion `src/proxy.ts`
 * keeps them refreshed on every subsequent request.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", errorDescription ?? error);
    return NextResponse.redirect(url);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Build the redirect response up-front so we can attach Set-Cookie headers
  // directly to it. This avoids the well-known Next.js pitfall where cookies
  // set via `next/headers` cookies() don't always propagate when the route
  // returns a redirect.
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.headers.get("cookie")
            ? parseCookieHeader(request.headers.get("cookie")!)
            : [];
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const url = new URL("/login", origin);
    url.searchParams.set("error", exchangeError.message);
    return NextResponse.redirect(url);
  }

  // Auto-claim ownership when the configured owner signs in.
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  if (ownerEmail) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && user.email.toLowerCase() === ownerEmail) {
      const admin = createAdminClient();
      await admin
        .from("owner_config")
        .upsert({ user_id: user.id }, { onConflict: "user_id" });
    }
  }

  return response;
}

/** Minimal `Cookie` header parser — only used to expose the request's
 *  cookies to the SSR client during the code exchange. */
function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(/;\s*/)
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return { name: pair, value: "" };
      return {
        name: pair.slice(0, idx).trim(),
        value: decodeURIComponent(pair.slice(idx + 1)),
      };
    });
}
