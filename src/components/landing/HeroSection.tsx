"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ENABLED_CATEGORIES } from "@/lib/categories";

export function HeroSection() {
  const categories = ENABLED_CATEGORIES;
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border)]/60">
      {/* OKLCH multi-layer glow — high-gamut */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[820px] -translate-x-1/2 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--landing-glow-a), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[18%] -z-10 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--landing-glow-c), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] bottom-[-10%] -z-10 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--landing-glow-b), transparent 70%)",
        }}
      />
      {/* grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgb(0_0_0_/_0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0_/_0.05)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      />
      {/* fade-out at bottom into page surface */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-[var(--background)]"
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-6 py-24 text-center sm:py-32 lg:py-40">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1 text-xs font-medium tracking-wide text-[var(--muted)] backdrop-blur"
        >
          coleção pessoal · 2026
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl"
        >
          <span className="text-[var(--landing-ink)]">Fragmentos de </span>
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(120deg, var(--landing-ink) 0%, var(--landing-ink) 45%, var(--landing-glow-c) 100%)",
            }}
          >
            tempo
          </span>
          <span className="text-[var(--landing-ink)]"> e </span>
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(120deg, var(--landing-glow-b) 0%, var(--landing-ink) 55%)",
            }}
          >
            entretenimento
          </span>
          <span className="text-[var(--landing-ink)]">.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="max-w-2xl text-balance text-base text-[var(--muted)] sm:text-lg"
        >
          Minha curadoria técnica de jogos, livros e experiências.
          Sincronizado com a realidade e arquivado para o futuro.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: "easeOut" }}
          className="mt-2 flex flex-col gap-3 sm:flex-row"
        >
          {categories.map((c, idx) => {
            const Icon = c.icon;
            const primary = idx === 0;
            // Per-CTA accent — matches the stats tiles so colors stay coherent
            // page-wide (board games → green, video games → blue, etc).
            const accent = `var(--landing-glow-${["a", "b", "c"][idx % 3]})`;
            return (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                style={
                  primary
                    ? {
                        boxShadow: `0 8px 30px -8px ${accent}`,
                      }
                    : {
                        boxShadow: `0 6px 24px -10px ${accent}`,
                      }
                }
                className={
                  primary
                    ? "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--landing-ink)] px-6 text-sm font-medium text-white transition-all hover:scale-[1.02]"
                    : "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--foreground)]/15 bg-[var(--surface)]/70 px-6 text-sm font-medium text-[var(--foreground)] backdrop-blur transition-all hover:scale-[1.02] hover:border-[var(--foreground)]/40 hover:bg-[var(--surface)]"
                }
              >
                <Icon size={16} /> {c.label}
              </Link>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
