"use client";

import { useState, useTransition } from "react";
import { Dice5, Gamepad2, Loader2 } from "lucide-react";
import { addBoardgame, addVideogame, searchBgg, searchIgdb } from "./actions";
import { cn } from "@/lib/utils";

type Mode = "boardgame" | "videogame";

type BggHit = { id: string; name: string; year: number | null; type: string };
type IgdbHit = {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
};

export function AddForm() {
  const [mode, setMode] = useState<Mode>("boardgame");
  const [query, setQuery] = useState("");
  const [bggHits, setBggHits] = useState<BggHit[]>([]);
  const [igdbHits, setIgdbHits] = useState<IgdbHit[]>([]);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      if (mode === "boardgame") {
        const results = await searchBgg(query);
        setBggHits(results);
      } else {
        const results = await searchIgdb(query);
        setIgdbHits(results as IgdbHit[]);
      }
    });
  }

  function onPick(id: string) {
    startAdd(async () => {
      if (mode === "boardgame") await addBoardgame(id);
      else await addVideogame(id);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        <TabBtn active={mode === "boardgame"} onClick={() => setMode("boardgame")}>
          <Dice5 size={14} /> Board game
        </TabBtn>
        <TabBtn active={mode === "videogame"} onClick={() => setMode("videogame")}>
          <Gamepad2 size={14} /> Video game
        </TabBtn>
      </div>

      <form onSubmit={onSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "boardgame" ? "Search BGG..." : "Search IGDB..."}
          className="h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        />
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="flex h-11 items-center gap-2 rounded-lg bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] disabled:opacity-50"
        >
          {searching && <Loader2 size={14} className="animate-spin" />}
          Search
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {mode === "boardgame" &&
          bggHits.map((hit) => (
            <ResultRow
              key={hit.id}
              title={hit.name}
              subtitle={hit.year ? String(hit.year) : hit.type}
              disabled={adding}
              onClick={() => onPick(hit.id)}
            />
          ))}
        {mode === "videogame" &&
          igdbHits.map((hit) => (
            <ResultRow
              key={hit.id}
              title={hit.name}
              subtitle={
                hit.first_release_date
                  ? new Date(hit.first_release_date * 1000).getFullYear().toString()
                  : undefined
              }
              cover={
                hit.cover?.image_id
                  ? `https://images.igdb.com/igdb/image/upload/t_thumb/${hit.cover.image_id}.jpg`
                  : undefined
              }
              disabled={adding}
              onClick={() => onPick(String(hit.id))}
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
        <img src={cover} alt="" className="h-14 w-10 rounded object-cover" />
      ) : (
        <div className="h-14 w-10 rounded bg-[var(--surface-hover)]" />
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
