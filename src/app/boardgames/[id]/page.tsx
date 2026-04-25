import { notFound } from "next/navigation";
import { StarRating } from "@/components/StarRating";
import { PlaysList, PlaysSummary } from "@/components/PlaysPanel";
import { ExternalLinks } from "@/components/ExternalLinks";
import { getBoardgame } from "@/lib/data";
import { summarizePlays } from "@/lib/preview";

export const dynamic = "force-dynamic";

export default async function BoardgameDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const view = await getBoardgame(id);
  if (!view) notFound();

  const externals: { source: string; url: string | null }[] = [];
  if (view.ludopedia_url) externals.push({ source: "ludopedia", url: view.ludopedia_url });

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

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 md:grid-cols-3">
        <Stat label="Jogadores" value={players} />
        <Stat
          label="Tempo"
          value={view.playing_time_min ? `${view.playing_time_min} min` : "—"}
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

      {externals.length > 0 && (
        <div className="mt-2">
          <ExternalLinks links={externals} />
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
