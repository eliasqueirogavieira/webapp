import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPreviewBoardgame, isPreviewMode } from "@/lib/preview";
import { createClient } from "@/lib/supabase/server";

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

  let title = "";
  let coverUrl: string | null = null;
  let year: number | null = null;

  if (isPreviewMode()) {
    const d = getPreviewBoardgame(id);
    if (!d) notFound();
    title = d.title;
    coverUrl = d.cover_url;
    year = d.year;
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("items")
      .select("title, cover_url, year")
      .eq("id", id)
      .maybeSingle<{ title: string; cover_url: string | null; year: number | null }>();
    if (!data) notFound();
    title = data.title;
    coverUrl = data.cover_url;
    year = data.year;
  }

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
            {coverUrl && (
              <Image
                src={coverUrl}
                alt={title}
                fill
                sizes="260px"
                className="object-cover"
                priority
              />
            )}
          </div>
          <div className="mt-3">
            <h2 className="text-sm font-medium leading-snug">{title}</h2>
            {year && (
              <p className="text-xs text-[var(--muted)]">{year}</p>
            )}
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
