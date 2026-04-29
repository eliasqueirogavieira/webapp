"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Clock, Trophy } from "lucide-react";
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

export function RecentPlaysRail({ plays }: { plays: HomePlayRow[] }) {
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
        {plays.map((p) => (
          <motion.div
            key={p.play_id}
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
            className="w-[260px] shrink-0"
          >
            <Link
              href={`/boardgames/${p.item_slug}`}
              className="group flex h-full items-stretch gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-hover)]">
                {p.item_cover_url && (
                  <Image
                    src={p.item_cover_url}
                    alt={p.item_title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div className="line-clamp-2 text-sm font-medium leading-snug text-[var(--foreground)]">
                  {p.item_title}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                  <span className="tabular-nums">{formatDate(p.played_on)}</span>
                  {p.duration_min !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {p.duration_min}m
                    </span>
                  )}
                  {p.won && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1"
                      style={{
                        background: "color-mix(in oklch, var(--landing-rating-high) 18%, transparent)",
                        color: "color-mix(in oklch, var(--landing-rating-high) 60%, var(--landing-ink))",
                        boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--landing-rating-high) 30%, transparent)",
                      }}
                    >
                      <Trophy size={11} /> Vitória
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
