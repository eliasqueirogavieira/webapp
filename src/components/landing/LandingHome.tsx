"use client";

import { useState, useTransition } from "react";
import type { HomePlayRow } from "@/lib/data";
import type { CategoryEnum } from "@/lib/categories";
import type { ItemCardData } from "@/components/ItemCard";
import { HeroSection } from "./HeroSection";
import { StatsBento } from "./StatsBento";
import { HighlightGrid } from "./HighlightGrid";
import { DetailDrawer } from "./DetailDrawer";
import { RecentPlaysRail } from "./RecentPlaysRail";
import { WishlistRail } from "./WishlistRail";

export type LandingSection = {
  enum: CategoryEnum;
  label: string;
  highlightLabel: string;
  count: number;
  avg: number | null;
  top: ItemCardData[];
  highlight: ItemCardData[];
};

type Selected = { section: string; item: ItemCardData } | null;

export function LandingHome({
  sections,
  totalItems,
  recentPlays,
  wishlist,
}: {
  sections: LandingSection[];
  totalItems: number;
  recentPlays: HomePlayRow[];
  wishlist: ItemCardData[];
}) {
  const [selected, setSelected] = useState<Selected>(null);
  const [, startTransition] = useTransition();

  const select = (section: string, item: ItemCardData) =>
    startTransition(() => setSelected({ section, item }));
  const close = () => startTransition(() => setSelected(null));

  return (
    <div className="flex flex-col">
      <HeroSection />

      <Section eyebrow="Estatísticas" title="A coleção em números">
        <StatsBento sections={sections} totalItems={totalItems} />
      </Section>

      {sections.map((s) => (
        <Section
          key={`top-${s.enum}`}
          eyebrow="Mais bem avaliados"
          title={s.label}
        >
          <HighlightGrid
            section={`top-${s.enum}`}
            items={s.top}
            selectedKey={selected?.section === `top-${s.enum}` ? selected.item.id : null}
            onSelect={(item) => select(`top-${s.enum}`, item)}
          />
        </Section>
      ))}

      {sections.map((s) => (
        <Section
          key={`highlight-${s.enum}`}
          eyebrow={s.highlightLabel}
          title={s.label}
        >
          <HighlightGrid
            section={`hl-${s.enum}`}
            items={s.highlight}
            selectedKey={selected?.section === `hl-${s.enum}` ? selected.item.id : null}
            onSelect={(item) => select(`hl-${s.enum}`, item)}
          />
        </Section>
      ))}

      {wishlist.length > 0 && (
        <Section eyebrow="Lista de desejos" title="Próximos da estante">
          <WishlistRail items={wishlist} currentYear={new Date().getFullYear()} />
        </Section>
      )}

      {recentPlays.length > 0 && (
        <Section eyebrow="Atividade" title="Últimas partidas">
          <RecentPlaysRail plays={recentPlays} />
        </Section>
      )}

      <footer className="mx-auto w-full max-w-7xl px-6 py-12 text-center text-xs text-[var(--muted)] lg:px-10">
        Dados de board games via Ludopedia, video games via IGDB.
      </footer>

      <DetailDrawer
        section={selected?.section ?? null}
        item={selected?.item ?? null}
        onClose={close}
      />
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      </header>
      {children}
    </section>
  );
}
