import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RatingBadge } from "@/components/RatingBadge";
import { ExternalLinks } from "@/components/ExternalLinks";
import { getVideogame } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VideogameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getVideogame(id);
  if (!view) notFound();

  const externals: { source: string; url: string | null }[] = [];
  if (view.grouvee_url) externals.push({ source: "grouvee", url: view.grouvee_url });
  if (view.igdb_id) {
    // IGDB indexes by slug, not numeric id — link to a title search instead.
    externals.push({
      source: "igdb",
      url: `https://www.igdb.com/search?q=${encodeURIComponent(view.title)}`,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/videogames"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} /> Todos os Video games
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
            {view.status && <Pill>{translateStatus(view.status)}</Pill>}
          </div>

          {view.genres.length > 0 && <TagList title="Gêneros" tags={view.genres} />}
          {view.platforms.length > 0 && <TagList title="Plataformas" tags={view.platforms} />}
          {view.developers.length > 0 && <TagList title="Desenvolvedoras" tags={view.developers} />}
          {view.publishers.length > 0 && <TagList title="Publicadoras" tags={view.publishers} />}
          {view.franchises.length > 0 && <TagList title="Franquias" tags={view.franchises} />}

          {externals.length > 0 && (
            <div className="mt-4">
              <ExternalLinks links={externals} />
            </div>
          )}
        </div>
      </div>
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
