import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RatingBadge } from "@/components/RatingBadge";
import { getPreviewVideogame, isPreviewMode, type VideogameDetail } from "@/lib/preview";

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
  videogame_details: {
    platforms: string[] | null;
    genres: string[] | null;
    developers: string[] | null;
    publishers: string[] | null;
    release_date: string | null;
    franchises: string[] | null;
  } | null;
  item_externals: { source: string; external_id: string; url: string | null }[];
};

type View = {
  title: string;
  year: number | null;
  cover_url: string | null;
  rating: number | null;
  status: string | null;
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
  franchises: string[];
  externals: { source: string; url: string | null }[];
};

async function loadDetail(id: string): Promise<View | null> {
  if (isPreviewMode()) {
    const d: VideogameDetail | null = getPreviewVideogame(id);
    if (!d) return null;
    return {
      title: d.title,
      year: d.year,
      cover_url: d.cover_url,
      rating: d.rating,
      status: d.status,
      platforms: d.platforms,
      genres: d.genres,
      developers: d.developers,
      publishers: d.publishers,
      franchises: d.franchises,
      externals: d.igdb_id
        ? [{ source: "igdb", url: `https://www.igdb.com/games/${d.igdb_id}` }]
        : [],
    };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(
      "id, title, year, cover_url, rating, play_count, status, notes, videogame_details(*), item_externals(source, external_id, url)",
    )
    .eq("id", id)
    .maybeSingle<DetailRow>();
  if (!data) return null;
  const d = data.videogame_details;
  return {
    title: data.title,
    year: data.year,
    cover_url: data.cover_url,
    rating: data.rating,
    status: data.status,
    platforms: d?.platforms ?? [],
    genres: d?.genres ?? [],
    developers: d?.developers ?? [],
    publishers: d?.publishers ?? [],
    franchises: d?.franchises ?? [],
    externals: data.item_externals.map((e) => ({ source: e.source, url: e.url })),
  };
}

export default async function VideogameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await loadDetail(id);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/videogames"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} /> All video games
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
          </div>

          {view.genres.length > 0 && <TagList title="Genres" tags={view.genres} />}
          {view.platforms.length > 0 && <TagList title="Platforms" tags={view.platforms} />}
          {view.developers.length > 0 && <TagList title="Developers" tags={view.developers} />}
          {view.publishers.length > 0 && <TagList title="Publishers" tags={view.publishers} />}
          {view.franchises.length > 0 && <TagList title="Franchises" tags={view.franchises} />}

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
