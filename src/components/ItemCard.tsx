import Image from "next/image";
import Link from "next/link";
import { RatingBadge } from "./RatingBadge";
import { cn } from "@/lib/utils";

export type ItemCardData = {
  id: string;
  category: "boardgame" | "videogame" | "movie" | "series" | "restaurant";
  title: string;
  year: number | null;
  cover_url: string | null;
  rating: number | null;
};

export function ItemCard({ item, className }: { item: ItemCardData; className?: string }) {
  const hrefCat = item.category === "boardgame" ? "boardgames" : "videogames";
  return (
    <Link
      href={`/${hrefCat}/${item.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl bg-[var(--surface)]",
        "border border-[var(--border)] hover:border-[var(--accent)]/40",
        "transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30",
        className,
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--surface-hover)]">
        {item.cover_url ? (
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            sizes="(min-width: 1280px) 200px, (min-width: 768px) 25vw, 45vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            no cover
          </div>
        )}
        {item.rating !== null && (
          <div className="absolute right-2 top-2">
            <RatingBadge rating={item.rating} size="sm" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-3">
        <div className="line-clamp-2 text-sm font-medium leading-snug">
          {item.title}
        </div>
        {item.year && (
          <div className="text-xs text-[var(--muted)]">{item.year}</div>
        )}
      </div>
    </Link>
  );
}
