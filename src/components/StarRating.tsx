import { cn } from "@/lib/utils";
import { displayRating } from "@/lib/ratings";

/**
 * 10-star rating display, supports fractional fill (e.g. 8.5 → 8.5 stars).
 * Two layers: full muted stars underneath, accent-colored stars clipped to
 * (rating/10)*100% on top.
 */
export function StarRating({
  rating,
  size = "md",
  showValue = true,
  className,
}: {
  rating: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}) {
  const value = rating ?? 0;
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));

  const starSize =
    size === "sm" ? 12 : size === "lg" ? 22 : 16;
  const valueCls =
    size === "sm" ? "text-xs" : size === "lg" ? "text-lg" : "text-sm";

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div className="relative inline-flex" aria-label={`Avaliação ${value} de 10`}>
        <Row size={starSize} muted />
        <div
          className="absolute left-0 top-0 overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <Row size={starSize} />
        </div>
      </div>
      {showValue && (
        <span
          className={cn(
            "font-mono tabular-nums font-semibold text-[var(--foreground)]",
            valueCls,
          )}
        >
          {displayRating(rating)}
          <span className="text-[var(--muted)] font-normal">/10</span>
        </span>
      )}
    </div>
  );
}

function Row({ size, muted = false }: { size: number; muted?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => (
        <Star key={i} size={size} muted={muted} />
      ))}
    </div>
  );
}

function Star({ size, muted }: { size: number; muted: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={muted ? "transparent" : "currentColor"}
      stroke="currentColor"
      strokeWidth={muted ? 1.5 : 0}
      className={muted ? "text-[var(--border)]" : "text-amber-400"}
      aria-hidden
    >
      <path
        strokeLinejoin="round"
        d="M12 2.5l2.92 5.91 6.52.95-4.72 4.6 1.11 6.5L12 17.4l-5.83 3.06 1.11-6.5L2.56 9.36l6.52-.95L12 2.5z"
      />
    </svg>
  );
}
