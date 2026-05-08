"use client";

import { useState, useTransition } from "react";
import { Loader2, Star, Trash2 } from "lucide-react";
import { updateRating, updateStatus } from "@/app/(app)/add/actions";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "owned", label: "Tenho" },
  { value: "played", label: "Jogado" },
  { value: "wishlist", label: "Lista de desejos" },
  { value: "backlog", label: "Backlog" },
  { value: "favorite", label: "Favorito" },
  { value: "abandoned", label: "Abandonado" },
];

/**
 * Owner-only controls on a detail page: clickable 1–10 stars + status pill
 * picker. Optimistic local state, server actions persist via the admin
 * client + layout revalidation. Hidden in preview mode (no internalId).
 */
export function OwnerControlsClient({
  internalId,
  initialRating,
  initialStatuses,
}: {
  internalId: string;
  initialRating: number | null;
  initialStatuses: string[] | null;
}) {
  const [rating, setRating] = useState<number | null>(initialRating);
  const [hover, setHover] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<string[]>(initialStatuses ?? []);
  const [pending, startTransition] = useTransition();

  function pickRating(next: number) {
    const target = rating === next ? null : next; // click same star = clear
    setRating(target);
    startTransition(async () => {
      await updateRating(internalId, target);
    });
  }

  /** Toggle: click a status that's active to remove it, otherwise add it. */
  function toggleStatus(value: string) {
    const next = statuses.includes(value)
      ? statuses.filter((s) => s !== value)
      : [...statuses, value];
    setStatuses(next);
    startTransition(async () => {
      await updateStatus(internalId, next.length ? next : null);
    });
  }

  const display = hover ?? rating ?? 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Sua nota
        </span>
        <div className="flex items-center gap-2">
          {pending && (
            <Loader2 size={14} className="animate-spin text-[var(--muted)]" />
          )}
          <span className="font-mono text-sm tabular-nums">
            {rating == null ? "—" : rating}
            <span className="text-[var(--muted)]">/10</span>
          </span>
          {rating != null && (
            <button
              type="button"
              onClick={() => pickRating(rating)}
              disabled={pending}
              className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50"
              aria-label="Limpar nota"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const filled = n <= display;
          return (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={() => pickRating(n)}
              onMouseEnter={() => setHover(n)}
              className={cn(
                "rounded p-0.5 transition-colors",
                filled ? "text-amber-400" : "text-[var(--border)]",
                "hover:text-amber-400 disabled:opacity-50",
              )}
              aria-label={`Nota ${n}`}
            >
              <Star size={20} fill={filled ? "currentColor" : "transparent"} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
          Status
        </span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = statuses.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={pending}
                onClick={() => toggleStatus(opt.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs ring-1 transition-colors",
                  active
                    ? "bg-[var(--foreground)] text-[var(--background)] ring-[var(--foreground)]"
                    : "bg-[var(--surface)] text-[var(--muted)] ring-[var(--border)] hover:text-[var(--foreground)]",
                  "disabled:opacity-50",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
