import { createClient } from "@/lib/supabase/server";
import { BentoTile } from "@/components/BentoTile";
import { ItemCard, type ItemCardData } from "@/components/ItemCard";
import { RatingBadge } from "@/components/RatingBadge";
import { getPreviewStats, isPreviewMode } from "@/lib/preview";

export const dynamic = "force-dynamic";

type HomeData = {
  bgCount: number;
  vgCount: number;
  bgAvg: number | null;
  vgAvg: number | null;
  topRated: ItemCardData[];
  recent: ItemCardData[];
};

async function loadData(): Promise<HomeData> {
  if (isPreviewMode()) return getPreviewStats();

  const supabase = await createClient();
  const [{ data: topRated }, { data: recent }, bgCount, vgCount, bgAvg, vgAvg] =
    await Promise.all([
      supabase
        .from("items")
        .select("id, category, title, year, cover_url, rating")
        .not("rating", "is", null)
        .order("rating", { ascending: false })
        .limit(6)
        .returns<ItemCardData[]>(),
      supabase
        .from("items")
        .select("id, category, title, year, cover_url, rating")
        .order("created_at", { ascending: false })
        .limit(6)
        .returns<ItemCardData[]>(),
      supabase.from("items").select("id", { count: "exact", head: true }).eq("category", "boardgame"),
      supabase.from("items").select("id", { count: "exact", head: true }).eq("category", "videogame"),
      supabase.from("items").select("rating").eq("category", "boardgame").not("rating", "is", null),
      supabase.from("items").select("rating").eq("category", "videogame").not("rating", "is", null),
    ]);
  const avg = (rows: Array<{ rating: number | null }> | null) => {
    if (!rows || rows.length === 0) return null;
    const nums = rows.map((r) => Number(r.rating)).filter((n) => Number.isFinite(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  return {
    bgCount: bgCount.count ?? 0,
    vgCount: vgCount.count ?? 0,
    bgAvg: avg(bgAvg.data),
    vgAvg: avg(vgAvg.data),
    topRated: topRated ?? [],
    recent: recent ?? [],
  };
}

export default async function Home() {
  const { bgCount, vgCount, bgAvg, vgAvg, topRated, recent } = await loadData();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Collection</h1>
        <p className="text-[var(--muted)]">
          Board games and video games — played, rated, remembered.
          {isPreviewMode() && (
            <span className="ml-2 rounded-md bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--accent)] ring-1 ring-[var(--border)]">
              preview mode (reading from CSVs)
            </span>
          )}
        </p>
      </header>

      <div className="grid grid-cols-6 gap-4">
        <BentoTile title="Board games" span="sm">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums">{bgCount}</div>
            <div className="text-xs text-[var(--muted)]">
              avg <RatingBadge rating={bgAvg} size="sm" />
            </div>
          </div>
        </BentoTile>

        <BentoTile title="Video games" span="sm">
          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums">{vgCount}</div>
            <div className="text-xs text-[var(--muted)]">
              avg <RatingBadge rating={vgAvg} size="sm" />
            </div>
          </div>
        </BentoTile>

        <BentoTile title="Total" span="sm">
          <div className="text-3xl font-semibold tabular-nums">
            {bgCount + vgCount}
          </div>
        </BentoTile>

        <BentoTile title="Top rated" subtitle="across everything" span="xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topRated.map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
          </div>
        </BentoTile>

        <BentoTile title="Recently added" span="xl">
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
