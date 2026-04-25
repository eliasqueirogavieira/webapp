import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PlaysList, PlaysSummary } from "@/components/PlaysPanel";
import { getBoardgame } from "@/lib/data";
import { summarizePlays } from "@/lib/preview";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AllPlaysPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const d = await getBoardgame(id);
  if (!d) notFound();

  const plays = d.plays;
  const summary = summarizePlays(plays);
  const totalPages = Math.max(1, Math.ceil(plays.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = plays.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/boardgames/${id}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft size={14} /> Voltar para o jogo
        </Link>
        <div className="text-sm text-[var(--muted)]">
          Página {safePage} / {totalPages}
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Todas as partidas</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Todas as partidas registradas na Ludopedia, da mais recente à mais antiga.
        </p>
      </header>

      <PlaysSummary summary={summary} />

      <PlaysList plays={slice} />

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-4">
          <PageLink id={id} page={safePage - 1} disabled={safePage === 1}>
            ← Anterior
          </PageLink>
          <PageNumbers id={id} current={safePage} total={totalPages} />
          <PageLink id={id} page={safePage + 1} disabled={safePage === totalPages}>
            Próxima →
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  id,
  page,
  disabled,
  children,
  active,
}: {
  id: string;
  page: number;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md px-3 py-1.5 text-sm text-[var(--muted)] opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={`/boardgames/${id}/plays?page=${page}`}
      className={
        active
          ? "rounded-md bg-[var(--foreground)] px-3 py-1.5 text-sm font-medium text-[var(--background)]"
          : "rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-hover)]"
      }
    >
      {children}
    </Link>
  );
}

function PageNumbers({
  id,
  current,
  total,
}: {
  id: string;
  current: number;
  total: number;
}) {
  // Show up to 7 page numbers centered on current, with ellipsis edges
  const pages: (number | "…")[] = [];
  const window = 1;
  const add = (n: number | "…") => pages.push(n);
  if (total <= 7) {
    for (let i = 1; i <= total; i++) add(i);
  } else {
    add(1);
    if (current > 2 + window) add("…");
    for (
      let i = Math.max(2, current - window);
      i <= Math.min(total - 1, current + window);
      i++
    )
      add(i);
    if (current < total - 1 - window) add("…");
    add(total);
  }
  return (
    <div className="flex items-center gap-1">
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-2 text-[var(--muted)]">
            …
          </span>
        ) : (
          <PageLink
            key={p}
            id={id}
            page={p}
            active={p === current}
          >
            {p}
          </PageLink>
        ),
      )}
    </div>
  );
}
