"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { ItemCardData } from "@/components/ItemCard";

export function WishlistRail({
  items,
  currentYear,
}: {
  items: ItemCardData[];
  currentYear: number;
}) {
  if (items.length === 0) return null;
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.06 } },
      }}
      className="-mx-6 overflow-x-auto px-6 lg:-mx-10 lg:px-10"
    >
      <div className="flex min-w-max gap-4 pb-4">
        {items.map((item) => {
          const upcoming =
            typeof item.year === "number" && item.year > currentYear;
          return (
            <motion.div
              key={item.id}
              variants={{
                hidden: { opacity: 0, x: 24 },
                show: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                },
              }}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="w-[180px] shrink-0"
            >
              <Link
                href={`/boardgames/${item.id}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-[var(--surface-hover)]">
                  {item.cover_url ? (
                    <Image
                      src={item.cover_url}
                      alt={item.title}
                      fill
                      sizes="180px"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-[var(--muted)]">
                      sem capa
                    </div>
                  )}
                  {item.wishlist_priority != null && (
                    <PriorityPip value={item.wishlist_priority} />
                  )}
                  {upcoming && (
                    <span
                      className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
                      style={{
                        background:
                          "color-mix(in oklch, var(--landing-glow-c) 22%, transparent)",
                        color:
                          "color-mix(in oklch, var(--landing-glow-c) 60%, var(--landing-ink))",
                        boxShadow:
                          "inset 0 0 0 1px color-mix(in oklch, var(--landing-glow-c) 30%, transparent)",
                      }}
                    >
                      <Sparkles size={10} /> {item.year}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="line-clamp-2 text-sm font-medium leading-snug text-[var(--foreground)]">
                    {item.title}
                  </div>
                  {item.year && !upcoming && (
                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.year}
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/** Five-dot priority indicator. Filled dots = priority steps from 1 (most) to value. */
function PriorityPip({ value }: { value: number }) {
  const filled = Math.max(1, 6 - Math.min(value, 5));
  return (
    <div className="absolute right-2 top-2 flex gap-0.5 rounded-full bg-black/40 px-1.5 py-1 backdrop-blur-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="block h-1 w-1 rounded-full"
          style={{
            background:
              i < filled
                ? "var(--landing-glow-a, #fff)"
                : "rgba(255,255,255,0.35)",
          }}
        />
      ))}
    </div>
  );
}
