import { createAdminClient } from "@/lib/supabase/admin";
import {
  igdbByIds,
  igdbCoverUrl,
  igdbReleaseDate,
  igdbSearch,
  igdbSplitCompanies,
} from "@/lib/apis/igdb";
import type { CategoryAdapter, SearchHit } from "./types";

const SOURCE = "igdb";

export const igdbAdapter: CategoryAdapter = {
  category: "videogame",
  sourceLabel: "IGDB",
  async search(query: string): Promise<SearchHit[]> {
    const hits = await igdbSearch(query, 12);
    return hits.map((g) => {
      const release = igdbReleaseDate(g);
      return {
        externalId: String(g.id),
        title: g.name,
        year: release ? Number(release.slice(0, 4)) : null,
        coverUrl: g.cover?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_thumb/${g.cover.image_id}.jpg`
          : null,
        subtitle: release ? release.slice(0, 4) : undefined,
      };
    });
  },
  async import(externalId: string): Promise<string> {
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("item_externals")
      .select("item_id")
      .eq("source", SOURCE)
      .eq("external_id", externalId)
      .maybeSingle<{ item_id: string }>();
    if (existing?.item_id) return existing.item_id;

    const [game] = await igdbByIds([externalId]);
    if (!game) throw new Error(`IGDB id ${externalId} not found`);

    const { developers, publishers } = igdbSplitCompanies(game);
    const releaseDate = igdbReleaseDate(game);

    const { data: inserted, error } = await supabase
      .from("items")
      .insert({
        category: "videogame",
        title: game.name,
        year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
        cover_url: game.cover?.image_id ? igdbCoverUrl(game.cover.image_id) : null,
        platforms: game.platforms?.map((p) => p.name) ?? [],
        genres: game.genres?.map((g2) => g2.name) ?? [],
        developers,
        publishers,
        franchises: game.franchises?.map((f) => f.name) ?? [],
        release_date: releaseDate,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !inserted) throw error ?? new Error("Insert failed");

    await supabase.from("item_externals").insert({
      item_id: inserted.id,
      source: SOURCE,
      external_id: externalId,
      url: null,
    });

    return inserted.id;
  },
};
