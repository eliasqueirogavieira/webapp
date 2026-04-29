"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Card } from "@heroui/react";
import type { ItemCardData } from "@/components/ItemCard";
import { RatingBadge } from "@/components/RatingBadge";

export function HighlightGrid({
  section,
  items,
  selectedKey,
  onSelect,
}: {
  /** Stable id for this grid; used to namespace viewTransitionName. */
  section: string;
  items: ItemCardData[];
  /** Id of the currently-open item in this grid (so we strip its VT name). */
  selectedKey: string | null;
  onSelect: (item: ItemCardData) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-sm text-[var(--muted)]">
        Nada por aqui ainda.
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.05 } },
      }}
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
    >
      {items.map((item) => {
        const vtName = `cover-${section}-${item.id}`;
        const isOpen = selectedKey === item.id;
        return (
          <motion.div
            key={item.id}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
              },
            }}
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
          >
            <Card
              variant="default"
              onClick={() => onSelect(item)}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 shadow-sm transition-shadow hover:shadow-xl"
            >
              <div
                className="relative aspect-[3/4] overflow-hidden bg-[var(--surface-hover)]"
                style={{
                  viewTransitionName: isOpen ? undefined : vtName,
                }}
              >
                {item.cover_url ? (
                  <Image
                    src={item.cover_url}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-[var(--muted)]">
                    sem capa
                  </div>
                )}
                {item.rating !== null && (
                  <div className="absolute right-2 top-2">
                    <RatingBadge rating={item.rating} size="sm" />
                  </div>
                )}
                {/* gradient overlay on hover for depth */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <div className="p-3">
                <div className="line-clamp-1 text-sm font-medium text-[var(--foreground)]">
                  {item.title}
                </div>
                {item.year && (
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {item.year}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
