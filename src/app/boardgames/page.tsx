import { createClient } from "@/lib/supabase/server";
import { ItemGrid } from "@/components/ItemGrid";
import type { ItemCardData } from "@/components/ItemCard";
import { getPreviewBoardgames, isPreviewMode } from "@/lib/preview";

export const dynamic = "force-dynamic";

async function loadBoardgames(): Promise<ItemCardData[]> {
  if (isPreviewMode()) return getPreviewBoardgames();
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, category, title, year, cover_url, rating")
    .eq("category", "boardgame")
    .order("rating", { ascending: false, nullsFirst: false })
    .order("title")
    .returns<ItemCardData[]>();
  return data ?? [];
}

export default async function BoardgamesPage() {
  const items = await loadBoardgames();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Board games</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {items.length} {items.length === 1 ? "game" : "games"}
        </p>
      </header>
      <ItemGrid items={items} />
    </div>
  );
}
