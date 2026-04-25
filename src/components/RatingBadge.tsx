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
      ? "text-sm px-2 py-0.5 min-w-7"
      : size === "lg"
      ? "text-xl px-3 py-1 min-w-10"
      : "text-base px-2.5 py-0.5 min-w-8";

  const unrated = rating === null || rating === undefined;
  // Solid dark backdrop with blur so the pill stays legible over any cover —
  // works equally well on dark covers and on the now-light page background.
  const colorCls = unrated
    ? "bg-black/40 text-zinc-200 ring-1 ring-white/15"
    : rating! >= 8
    ? "bg-black/70 text-emerald-300 ring-1 ring-emerald-400/50"
    : rating! >= 6
    ? "bg-black/70 text-amber-300 ring-1 ring-amber-400/50"
    : "bg-black/70 text-zinc-100 ring-1 ring-white/25";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono tabular-nums font-semibold backdrop-blur-md",
        sizeCls,
        colorCls,
        className,
      )}
    >
      {displayRating(rating)}
    </span>
  );
}
