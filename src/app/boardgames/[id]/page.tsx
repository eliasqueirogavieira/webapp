import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RatingBadge } from "@/components/RatingBadge";
import { getPreviewBoardgame, isPreviewMode, type BoardgameDetail } from "@/lib/preview";

export const dynamic = "force-dynamic";

type DetailRow = {
  id: string;
  title: string;
  year: number | null;
  cover_url: string | null;
  rating: number | null;
  play_count: number;
  status: string | null;
  notes: string | null;
  boardgame_details: {
    min_players: number | null;
    max_players: number | null;
    playing_time_min: number | null;
    weight: number | null;
    bgg_rank: number | null;
    mechanics: string[] | null;
    categories: string[] | null;
  } | null;
  item_externals: { source: string; external_id: string; url: string | null }[];
};

type View = {
  title: string;
  year: number | null;
  cover_url: string | null;
  rating: number | null;
  play_count: number;
  status: string | null;
  min_players: number | null;
  max_players: number | null;
  playing_time_min: number | null;
  weight: number | null;
  bgg_rank: number | null;
  mechanics: string[];
  categories: string[];
  externals: { source: string; url: string | null }[];
};

async function loadDetail(id: string): Promise<View | null> {
  if (isPreviewMode()) {
    const d: BoardgameDetail | null = getPreviewBoardgame(id);
    if (!d) return null;
    return {
      title: d.title,
      year: d.year,
      cover_url: d.cover_url,
      rating: d.rating,
      play_count: d.play_count,
      status: d.status,
      min_players: d.min_players,
      max_players: d.max_players,
      playing_time_min: d.playing_time_min,
      weight: d.weight,
      bgg_rank: d.bgg_rank,
      mechanics: d.mechanics,
      categories: d.categories,
      externals: [
        {
          source: "bgg",
          url: `https://boardgamegeek.com/boardgame/${d.bgg_id}`,
        },
      ],
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "id, title, year, cover_url, rating, play_count, status, notes, boardgame_details(*), item_externals(source, external_id, url)",
    )
    .eq("id", id)
    .maybeSingle<DetailRow>();
  if (!data) return null;
  const d = data.boardgame_details;
  return {
    title: data.title,
    year: data.year,
    cover_url: data.cover_url,
    rating: data.rating,
    play_count: data.play_count,
    status: data.status,
    min_players: d?.min_players ?? null,
    max_players: d?.max_players ?? null,
    playing_time_min: d?.playing_time_min ?? null,
    weight: d?.weight ?? null,
    bgg_rank: d?.bgg_rank ?? null,
    mechanics: d?.mechanics ?? [],
    categories: d?.categories ?? [],
    externals: data.item_externals.map((e) => ({ source: e.source, url: e.url })),
  };
}

export default async function BoardgameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await loadDetail(id);
  if (!view) notFound();

  const players =
    view.min_players === view.max_players
      ? `${view.min_players ?? "?"}`
      : `${view.min_players ?? "?"}–${view.max_players ?? "?"}`;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/boardgames"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} /> All board games
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[var(--surface)]">
          {view.cover_url ? (
            <Image
              src={view.cover_url}
              alt={view.title}
              fill
              sizes="260px"
              className="object-cover"
              priority
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{view.title}</h1>
            {view.year && (
              <p className="mt-1 text-sm text-[var(--muted)]">{view.year}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <RatingBadge rating={view.rating} size="lg" />
            {view.status && <Pill>{view.status}</Pill>}
            {view.play_count > 0 && <Pill>{view.play_count} plays</Pill>}
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Players" value={players} />
            <Stat
              label="Time"
              value={view.playing_time_min ? `${view.playing_time_min} min` : "—"}
            />
            <Stat
              label="Weight"
              value={view.weight ? `${view.weight.toFixed(2)} / 5` : "—"}
            />
            <Stat
              label="BGG rank"
              value={view.bgg_rank ? `#${view.bgg_rank}` : "—"}
            />
          </dl>

          {view.mechanics.length > 0 && (
            <TagList title="Mechanics" tags={view.mechanics} />
          )}
          {view.categories.length > 0 && (
            <TagList title="Categories" tags={view.categories} />
          )}

          {view.externals.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {view.externals
                .filter((e) => e.url)
                .map((e) => (
                  <a
                    key={e.source}
                    href={e.url!}
                    target="_blank"
                    rel="noopener"
                    className="text-[var(--accent)] hover:underline"
                  >
                    {e.source}
                  </a>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)] ring-1 ring-[var(--border)]">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function TagList({ title, tags }: { title: string; tags: string[] }) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs ring-1 ring-[var(--border)]"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
