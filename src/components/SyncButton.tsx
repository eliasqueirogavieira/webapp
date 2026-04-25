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
 * Lives in the (app) sidebar; visibility is gated by the parent layout.
 */
export function SyncButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, startTransition] = useTransition();

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

  if (status.kind === "success") {
    return (
      <a
        href={status.runsUrl}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15"
      >
        <ExternalLink size={14} />
        Iniciado · ver no GitHub
      </a>
    );
  }

  if (status.kind === "error") {
    return (
      <div
        className="flex items-center gap-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-500/30"
        title={status.message}
      >
        <RefreshCw size={14} />
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
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--foreground)]/80",
        "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors",
        pending && "cursor-not-allowed opacity-70",
      )}
    >
      {pending ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <RefreshCw size={16} />
      )}
      {pending ? "Sincronizando…" : "Sincronizar agora"}
    </button>
  );
}
