import { cn } from "@/lib/utils";
import { displayRating } from "@/lib/ratings";

/**
 * 0–10 rating pill. Color shifts from muted (low) to accent (high).
 */
export function RatingBadge({
  rating,
  size = "md",
  className,
}: {
  rating: number | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "sm"
      ? "text-xs px-1.5 py-0.5"
      : size === "lg"
      ? "text-base px-2.5 py-1"
      : "text-sm px-2 py-0.5";

  const unrated = rating === null || rating === undefined;
  const colorCls = unrated
    ? "bg-[var(--surface-hover)] text-[var(--muted)]"
    : rating! >= 8
    ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
    : rating! >= 6
    ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25"
    : "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/25";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-mono tabular-nums",
        sizeCls,
        colorCls,
        className,
      )}
    >
      {displayRating(rating)}
    </span>
  );
}
