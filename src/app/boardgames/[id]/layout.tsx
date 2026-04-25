import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBoardgameCover } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Shared layout for /boardgames/[id] and /boardgames/[id]/plays — keeps the
 * cover + breadcrumb on the left, lets the right column swap between the
 * detail and the full plays table without re-fetching/re-rendering the cover.
 */
export default async function BoardgameDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cover = await getBoardgameCover(id);
  if (!cover) notFound();

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/boardgames"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft size={14} /> Todos os Board games
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
        <aside className="md:sticky md:top-10 md:self-start">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-[var(--surface)]">
            {cover.cover_url && (
              <Image
                src={cover.cover_url}
                alt={cover.title}
                fill
                sizes="260px"
                className="object-cover"
                priority
              />
            )}
          </div>
          <div className="mt-3">
            <h2 className="text-sm font-medium leading-snug">{cover.title}</h2>
            {cover.year && (
              <p className="text-xs text-[var(--muted)]">{cover.year}</p>
            )}
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
