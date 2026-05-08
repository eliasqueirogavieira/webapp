"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { addItemFromAdapter, searchForCategory } from "./actions";
import type { SearchHit } from "@/lib/add-adapters";
import { getCategoryByEnum, type CategoryEnum } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Only serializable fields — server → client. The icon + label are
 *  resolved on the client via getCategoryByEnum() (lucide icons are
 *  React components, which can't cross the RSC boundary). */
export type AddTab = {
  category: CategoryEnum;
  sourceLabel: string;
};

export function AddForm({ tabs }: { tabs: AddTab[] }) {
  const [activeCategory, setActiveCategory] = useState<CategoryEnum>(
    tabs[0]?.category ?? "boardgame",
  );
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  const activeTab = tabs.find((t) => t.category === activeCategory) ?? tabs[0];

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      const results = await searchForCategory(activeCategory, query);
      setHits(results);
    });
  }

  function onPick(externalId: string) {
    startAdd(async () => {
      await addItemFromAdapter(activeCategory, externalId);
    });
  }

  function switchTab(next: CategoryEnum) {
    setActiveCategory(next);
    setHits([]);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const config = getCategoryByEnum(t.category);
          const Icon = config.icon;
          return (
            <TabBtn
              key={t.category}
              active={activeCategory === t.category}
              onClick={() => switchTab(t.category)}
            >
              <Icon size={14} /> {config.label}
            </TabBtn>
          );
        })}
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Pesquisar no ${activeTab?.sourceLabel ?? ""}...`}
          className="h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="flex h-11 items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        >
          {searching && <Loader2 size={14} className="animate-spin" />}
          Pesquisar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {hits.map((hit) => (
          <ResultRow
            key={`${activeCategory}-${hit.externalId}`}
            title={hit.title}
            subtitle={hit.subtitle}
            cover={hit.coverUrl ?? undefined}
            disabled={adding}
            onClick={() => onPick(hit.externalId)}
          />
        ))}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-[var(--foreground)] text-[var(--background)]"
          : "bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]",
      )}
    >
      {children}
    </button>
  );
}

function ResultRow({
  title,
  subtitle,
  cover,
  disabled,
  onClick,
}: {
  title: string;
  subtitle?: string;
  cover?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left hover:bg-[var(--surface-hover)] disabled:opacity-50"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          className="h-14 w-10 shrink-0 rounded border border-[var(--border)] object-cover"
        />
      ) : (
        <div className="h-14 w-10 shrink-0 rounded border border-dashed border-[var(--border)] bg-[var(--surface-hover)]" />
      )}
      <div className="flex flex-col">
        <span className="font-medium">{title}</span>
        {subtitle && (
          <span className="text-xs text-[var(--muted)]">{subtitle}</span>
        )}
      </div>
    </button>
  );
}
