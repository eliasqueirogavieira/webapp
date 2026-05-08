"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Single-owner email + password sign-in.
 *
 * The owner account must exist in Supabase Authentication first — create
 * it once via the Supabase dashboard (Authentication → Users → Add user)
 * with the email that matches `OWNER_EMAIL` in env. After that, signing
 * in here triggers `ensureOwnerClaim()` in the layout, which writes the
 * owner_config row that unlocks RLS-gated writes.
 *
 * No Google / magic link / OAuth flows on purpose — this is a single-user
 * app and password sign-in avoids email-rate-limit and PKCE-cookie pitfalls.
 */
export default function LoginPage() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    // Hard navigate: tears down the React tree so Next.js's in-memory
    // Router Cache (which would otherwise keep the pre-login RSC payload
    // for routes the user already visited) is fully cleared. router.refresh
    // alone only invalidates the current route, leaving stale layouts on
    // /boardgames, /videogames, etc.
    window.location.href = "/";
  }

  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col gap-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="text-sm text-[var(--muted)]">
        Apenas o dono pode editar a coleção. A visualização é pública.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha"
          className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
