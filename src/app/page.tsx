import { BentoTile } from "@/components/BentoTile";
import { ItemCard } from "@/components/ItemCard";
import { RatingBadge } from "@/components/RatingBadge";
import { getHomeStats } from "@/lib/data";
import { isPreviewMode } from "@/lib/preview";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { bgCount, vgCount, bgAvg, vgAvg, topRated, recent } = await getHomeStats();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Elias's Hobbies DB</h1>
        <p className="text-[var(--muted)]">
          Board games e video games — jogados, avaliados, registrados.
          {isPreviewMode() && (
            <span className="ml-2 rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--accent)] ring-1 ring-[var(--border)]">
              modo prévia (lendo dos JSONs locais)
            </span>
          )}
        </p>
      </header>

      <div className="grid grid-cols-6 gap-4">
        <BentoTile title="Board games" span="sm">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums">{bgCount}</div>
            <div className="text-xs text-[var(--muted)]">
              média <RatingBadge rating={bgAvg} size="sm" />
            </div>
          </div>
        </BentoTile>

        <BentoTile title="Video games" span="sm">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums">{vgCount}</div>
            <div className="text-xs text-[var(--muted)]">
              média <RatingBadge rating={vgAvg} size="sm" />
            </div>
          </div>
        </BentoTile>

        <BentoTile title="Total" span="sm">
          <div className="text-3xl font-semibold tabular-nums">
            {bgCount + vgCount}
          </div>
        </BentoTile>

        <BentoTile title="Mais bem avaliados" subtitle="em toda a coleção" span="xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topRated.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        </BentoTile>

        <BentoTile title="Adicionados recentemente" span="xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        </BentoTile>
      </div>
    </div>
  );
}
