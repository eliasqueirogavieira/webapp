import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/StarRating";
import { PlaysList, PlaysSummary } from "@/components/PlaysPanel";
import { ExternalLinks } from "@/components/ExternalLinks";
import {
  getPreviewBoardgame,
  isPreviewMode,
  summarizePlays,
  type BoardgameDetail,
} from "@/lib/preview";

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
  rating: number | null;
  status: string | null;
  min_players: number | null;
  max_players: number | null;
  playing_time_min: number | null;
  weight: number | null;
  bgg_rank: number | null;
  age_min: number | null;
  designers: string[];
  artists: string[];
  themes: string[];
  mechanics: string[];
  categories: string[];
  externals: { source: string; url: string | null }[];
  plays: BoardgameDetail["plays"];
};

async function loadView(id: string): Promise<View | null> {
  if (isPreviewMode()) {
    const d = getPreviewBoardgame(id);
    if (!d) return null;
    const externals: { source: string; url: string | null }[] = [];
    if (d.ludopedia_url) externals.push({ source: "ludopedia", url: d.ludopedia_url });
    externals.push({
      source: "bgg",
      url: `https://boardgamegeek.com/boardgame/${d.bgg_id}`,
    });
    return {
      title: d.title,
      year: d.year,
      rating: d.rating,
      status: d.status,
      min_players: d.min_players,
      max_players: d.max_players,
      playing_time_min: d.playing_time_min,
      weight: d.weight,
      bgg_rank: d.bgg_rank,
      age_min: d.age_min,
      designers: d.designers,
      artists: d.artists,
      themes: d.themes,
      mechanics: d.mechanics,
      categories: d.categories,
      externals,
      plays: d.plays,
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
    rating: data.rating,
    status: data.status,
    min_players: d?.min_players ?? null,
    max_players: d?.max_players ?? null,
    playing_time_min: d?.playing_time_min ?? null,
    weight: d?.weight ?? null,
    bgg_rank: d?.bgg_rank ?? null,
    age_min: null,
    designers: [],
    artists: [],
    themes: [],
    mechanics: d?.mechanics ?? [],
    categories: d?.categories ?? [],
    externals: data.item_externals.map((e) => ({ source: e.source, url: e.url })),
    plays: [],
  };
}

export default async function BoardgameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await loadView(id);
  if (!view) notFound();

  const players =
    view.min_players === view.max_players
      ? `${view.min_players ?? "?"}`
      : `${view.min_players ?? "?"}–${view.max_players ?? "?"}`;
  const summary = summarizePlays(view.plays);
  const latestFive = view.plays.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{view.title}</h1>
          {view.year && (
            <p className="mt-1 text-sm text-[var(--muted)]">{view.year}</p>
          )}
        </div>

        <StarRating rating={view.rating} size="lg" />

        <div className="flex flex-wrap gap-2">
          {view.status && <Pill>{translateStatus(view.status)}</Pill>}
          {summary.total_plays > 0 && (
            <Pill>
              {summary.total_plays} {summary.total_plays === 1 ? "partida" : "partidas"}
            </Pill>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 md:grid-cols-5">
        <Stat label="Jogadores" value={players} />
        <Stat
          label="Tempo"
          value={view.playing_time_min ? `${view.playing_time_min} min` : "—"}
        />
        <Stat
          label="Peso"
          value={view.weight ? `${view.weight.toFixed(2)} / 5` : "—"}
        />
        <Stat
          label="Rank BGG"
          value={view.bgg_rank ? `#${view.bgg_rank}` : "—"}
        />
        <Stat
          label="Idade"
          value={view.age_min ? `${view.age_min}+` : "—"}
        />
      </dl>

      {view.designers.length > 0 && (
        <CreditRow label="Design" names={view.designers} />
      )}
      {view.artists.length > 0 && (
        <CreditRow label="Arte" names={view.artists} />
      )}
      {view.themes.length > 0 && (
        <TagList title="Temas" tags={view.themes} />
      )}
      {view.mechanics.length > 0 && (
        <TagList title="Mecânicas" tags={view.mechanics} />
      )}
      {view.categories.length > 0 && (
        <TagList title="Categorias" tags={view.categories} />
      )}

      {summary.total_plays > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Partidas</h2>
          <PlaysSummary summary={summary} />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              {latestFive.length === 1 ? "Última" : `Últimas ${latestFive.length}`}
            </h3>
            <PlaysList
              plays={latestFive}
              showAllHref={
                view.plays.length > 5 ? `/boardgames/${id}/plays` : undefined
              }
            />
          </div>
        </section>
      )}

      {view.externals.length > 0 && (
        <div className="mt-2">
          <ExternalLinks links={view.externals} />
        </div>
      )}
    </div>
  );
}

const STATUS_PT: Record<string, string> = {
  owned: "tenho",
  played: "jogado",
  wishlist: "lista de desejos",
  backlog: "backlog",
  abandoned: "abandonado",
};
function translateStatus(s: string): string {
  return STATUS_PT[s] ?? s;
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

function CreditRow({ label, names }: { label: string; names: string[] }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <div className="mt-1 text-sm">
        {names.map((n, i) => (
          <span key={n}>
            <span className="font-medium">{n}</span>
            {i < names.length - 1 && (
              <span className="text-[var(--muted)]">, </span>
            )}
          </span>
        ))}
      </div>
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
