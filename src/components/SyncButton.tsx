"use client";

import { useState, useTransition, useEffect } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; runsUrl: string }
  | { kind: "error"; message: string };

/**
 * Owner-only button that fires the GitHub Actions sync workflow.
 * Visibility is gated by the parent layout. Two visual variants for
 * the two layouts that mount it (sidebar pill vs. topnav rounded chip).
 */
export function SyncButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "topnav";
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const isTopnav = variant === "topnav";

  // Auto-clear success/error after 6s.
  useEffect(() => {
    if (status.kind === "success" || status.kind === "error") {
      const t = setTimeout(() => setStatus({ kind: "idle" }), 6000);
      return () => clearTimeout(t);
    }
  }, [status]);

  function onClick() {
    setStatus({ kind: "pending" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/sync", { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.ok) {
          setStatus({ kind: "success", runsUrl: body.runs_url });
        } else {
          setStatus({
            kind: "error",
            message: body.error || `HTTP ${res.status}`,
          });
        }
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Erro desconhecido",
        });
      }
    });
  }

  // Shape primitives — same content, different shell per variant.
  const shellSidebar =
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--foreground)]/80 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors";
  const shellTopnav =
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-[var(--foreground)]/80 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors";
  const iconSize = isTopnav ? 14 : 16;

  if (status.kind === "success") {
    return (
      <a
        href={status.runsUrl}
        target="_blank"
        rel="noopener"
        className={cn(
          isTopnav
            ? "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15"
            : "flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15",
        )}
      >
        <ExternalLink size={iconSize} />
        {isTopnav ? "Iniciado" : "Iniciado · ver no GitHub"}
      </a>
    );
  }

  if (status.kind === "error") {
    return (
      <div
        className={cn(
          isTopnav
            ? "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm bg-red-500/10 text-red-700 ring-1 ring-red-500/30"
            : "flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-red-500/10 text-red-700 ring-1 ring-red-500/30",
        )}
        title={status.message}
      >
        <RefreshCw size={iconSize} />
        Erro · {status.message.slice(0, 24)}
      </div>
    );
  }

  const pending = status.kind === "pending";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={cn(
        isTopnav ? shellTopnav : shellSidebar,
        pending && "cursor-not-allowed opacity-70",
      )}
    >
      {pending ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        <RefreshCw size={iconSize} />
      )}
      {pending ? "Sincronizando…" : isTopnav ? "Sincronizar" : "Sincronizar agora"}
    </button>
  );
}
