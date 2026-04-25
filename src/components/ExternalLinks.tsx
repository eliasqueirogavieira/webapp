import Image from "next/image";
import { ExternalLink } from "lucide-react";

type Source = {
  /** Brand label, properly cased: "BGG", "Ludopedia", "IGDB", "Grouvee". */
  label: string;
  /** Path inside /public, or null if we don't have a logo and should fall back. */
  iconSrc: string | null;
};

const SOURCES: Record<string, Source> = {
  bgg: { label: "BGG", iconSrc: "/icons/bgg.png" },
  ludopedia: { label: "Ludopedia", iconSrc: "/icons/ludopedia.png" },
  igdb: { label: "IGDB", iconSrc: null },
  grouvee: { label: "Grouvee", iconSrc: null },
};

export function ExternalLinks({
  links,
}: {
  links: { source: string; url: string | null }[];
}) {
  const rendered = links
    .filter((l): l is { source: string; url: string } => !!l.url)
    .map((l) => ({
      ...l,
      meta: SOURCES[l.source] ?? { label: l.source, iconSrc: null },
    }));

  if (rendered.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {rendered.map(({ source, url, meta }) => (
        <a
          key={source}
          href={url}
          target="_blank"
          rel="noopener"
          className="group inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)]/85 transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          {meta.iconSrc ? (
            <Image
              src={meta.iconSrc}
              alt=""
              width={16}
              height={16}
              className="rounded-sm"
            />
          ) : (
            <ExternalLink size={14} className="text-[var(--muted)]" />
          )}
          <span>{meta.label}</span>
        </a>
      ))}
    </div>
  );
}
