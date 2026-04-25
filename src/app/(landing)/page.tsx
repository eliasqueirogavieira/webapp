import Link from "next/link";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { CompactPlayRow } from "@/components/CompactPlayRow";
import { RatingBadge } from "@/components/RatingBadge";
import { getHomeStats, type CategoryStats } from "@/lib/data";
import { ENABLED_CATEGORIES, type CategoryConfig } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const { byCategory, recentPlays } = await getHomeStats();

  const visible = ENABLED_CATEGORIES.map((c) => ({
    config: c,
    stats: byCategory[c.enum],
  })).filter((x): x is { config: CategoryConfig; stats: CategoryStats } => !!x.stats);

  const totalItems = visible.reduce((sum, v) => sum + v.stats.count, 0);

  return (
    <div className="flex flex-col">
      <Hero />

      <Section eyebrow="Estatísticas" title="A coleção em números">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {visible.map(({ config, stats }) => (
            <StatCard
              key={config.enum}
              label={config.label}
              value={stats.count}
              avg={stats.avg}
            />
          ))}
          <StatCard label="Total" value={totalItems} />
        </div>
      </Section>

      {visible.map(({ config, stats }) => (
        <Section
          key={`top-${config.enum}`}
          eyebrow="Mais bem avaliados"
          title={config.label}
          href={`/${config.slug}`}
          cta="Ver todos"
        >
          <CardRow items={stats.top} />
        </Section>
      ))}

      {visible.map(({ config, stats }) => (
        <Section
          key={`recent-${config.enum}`}
          eyebrow="Adicionados recentemente"
          title={config.label}
        >
          <CardRow items={stats.recent} />
        </Section>
      ))}

      {recentPlays.length > 0 && (
        <Section eyebrow="Atividade" title="Últimas partidas">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentPlays.map((p) => (
              <CompactPlayRow key={p.play_id} play={p} />
            ))}
          </div>
        </Section>
      )}

      <footer className="mx-auto w-full max-w-7xl px-6 py-12 text-center text-xs text-[var(--muted)] lg:px-10">
        Dados de board games via Ludopedia, video games via IGDB.
      </footer>
    </div>
  );
}

// ---------- hero ----------

function Hero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--border)]/60">
      {/* subtle grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,rgb(0_0_0_/_0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0_/_0.05)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      {/* radial accent glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(110_231_183_/_0.35),transparent_70%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-[var(--background)]"
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-6 py-24 text-center sm:py-32 lg:py-40">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-1 text-xs font-medium tracking-wide text-[var(--muted)] backdrop-blur">
          coleção pessoal · 2026
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl lg:text-7xl">
          Board games e video games,
          <br className="hidden sm:block" /> jogados e lembrados.
        </h1>
        <p className="max-w-2xl text-balance text-base text-[var(--muted)] sm:text-lg">
          Tudo que joguei, com nota, partidas registradas, designers e tudo o
          mais — sincronizado com a Ludopedia e o IGDB.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {ENABLED_CATEGORIES.map((c, idx) => {
            const Icon = c.icon;
            const primary = idx === 0;
            return (
              <Link
                key={c.slug}
                href={`/${c.slug}`}
                className={
                  primary
                    ? "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
                    : "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--foreground)]/15 bg-[var(--surface)]/70 px-6 text-sm font-medium text-[var(--foreground)] backdrop-blur transition-colors hover:border-[var(--foreground)]/40 hover:bg-[var(--surface)]"
                }
              >
                <Icon size={16} /> {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- section primitives ----------

function Section({
  eyebrow,
  title,
  cta,
  href,
  children,
}: {
  eyebrow: string;
  title: string;
  cta?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            {eyebrow}
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
        {cta && href && (
          <Link
            href={href}
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {cta} →
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function CardRow({ items }: { items: ItemCardData[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center text-sm text-[var(--muted)]">
        Nada por aqui ainda.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((i) => (
        <ItemCard key={i.id} item={i} />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  avg,
}: {
  label: string;
  value: number;
  avg?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="text-4xl font-semibold tabular-nums">{value}</div>
        {avg !== undefined && (
          <div className="text-xs text-[var(--muted)]">
            média <RatingBadge rating={avg ?? null} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
