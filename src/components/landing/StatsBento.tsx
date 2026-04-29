"use client";

import { motion } from "motion/react";
import { Card } from "@heroui/react";
import { RatingBadge } from "@/components/RatingBadge";
import type { LandingSection } from "./LandingHome";

export function StatsBento({
  sections,
  totalItems,
}: {
  sections: LandingSection[];
  totalItems: number;
}) {
  // Per-tile OKLCH accent — keeps each stat visually distinct while ensuring
  // every tile carries the same treatment (glow + gradient number).
  const ACCENTS = [
    "var(--landing-glow-a)", // green — board games
    "var(--landing-glow-b)", // blue — video games
    "var(--landing-glow-c)", // magenta — total
  ];

  const tiles = [
    ...sections.map((s) => ({
      key: s.enum,
      label: s.label,
      value: s.count,
      avg: s.avg,
    })),
    { key: "total", label: "Total", value: totalItems, avg: null as number | null },
  ];

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.08 } },
      }}
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {tiles.map((t, i) => {
        const accent = ACCENTS[i % ACCENTS.length];
        return (
          <motion.div
            key={t.key}
            variants={{
              hidden: { opacity: 0, y: 18 },
              show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="relative"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-2 -z-10 rounded-3xl opacity-50 blur-2xl"
              style={{
                background: `radial-gradient(closest-side, ${accent}, transparent 75%)`,
              }}
            />
            <Card
              variant="default"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_2px_30px_-12px_rgb(0_0_0/_0.15)] transition-shadow hover:shadow-[0_8px_40px_-12px_rgb(0_0_0/_0.2)]"
            >
              <Card.Content className="p-0">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  {t.label}
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <div
                    className="text-5xl font-semibold tabular-nums bg-clip-text text-transparent"
                    style={{
                      backgroundImage: `linear-gradient(135deg, var(--landing-ink), ${accent})`,
                    }}
                  >
                    {t.value}
                  </div>
                  {t.avg !== null && t.avg !== undefined && (
                    <div className="text-xs text-[var(--muted)]">
                      média <RatingBadge rating={t.avg} size="sm" />
                    </div>
                  )}
                </div>
              </Card.Content>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
