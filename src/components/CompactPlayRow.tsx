import Image from "next/image";
import Link from "next/link";
import { Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomePlayRow } from "@/lib/preview";

const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_PT[m - 1]} ${y}`;
}

export function CompactPlayRow({ play }: { play: HomePlayRow }) {
  return (
    <Link
      href={`/boardgames/${play.item_slug}`}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 pr-3",
        "transition-colors hover:border-[var(--foreground)]/30 hover:bg-[var(--surface-hover)]",
      )}
    >
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--surface-hover)]">
        {play.item_cover_url && (
          <Image
            src={play.item_cover_url}
            alt={play.item_title}
            fill
            sizes="40px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="truncate text-sm font-medium text-[var(--foreground)]">
          {play.item_title}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="tabular-nums">{formatDate(play.played_on)}</span>
          {play.duration_min !== null && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {play.duration_min} min
            </span>
          )}
        </div>
      </div>
      {play.won && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/30">
          <Trophy size={11} /> Vitória
        </span>
      )}
    </Link>
  );
}
