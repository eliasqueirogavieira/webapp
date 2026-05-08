import { createAdminClient } from "@/lib/supabase/admin";
import { bggSearch, bggThings } from "@/lib/apis/bgg";
import type { CategoryAdapter, SearchHit } from "./types";

const SOURCE = "bgg";
const BGG_URL = (id: string) => `https://boardgamegeek.com/boardgame/${id}`;

export const bggAdapter: CategoryAdapter = {
  category: "boardgame",
  sourceLabel: "BoardGameGeek",
  async search(query: string): Promise<SearchHit[]> {
    const hits = await bggSearch(query);
    return hits.map((h) => ({
      externalId: h.id,
      title: h.name,
      year: h.year,
      coverUrl: null, // /search doesn't return covers; /thing does, but skip for speed
      subtitle: h.year ? String(h.year) : h.type,
    }));
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

    const [thing] = await bggThings([externalId]);
    if (!thing) throw new Error(`BGG id ${externalId} not found`);

    const { data: inserted, error } = await supabase
      .from("items")
      .insert({
        category: "boardgame",
        title: thing.name,
        year: thing.year,
        cover_url: thing.image ?? thing.thumbnail,
        min_players: thing.minPlayers,
        max_players: thing.maxPlayers,
        playing_time_min: thing.playingTimeMin,
        weight: thing.weight,
        bgg_rank: thing.bggRank,
        mechanics: thing.mechanics,
        designers: thing.designers,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !inserted) throw error ?? new Error("Insert failed");

    await supabase.from("item_externals").insert({
      item_id: inserted.id,
      source: SOURCE,
      external_id: externalId,
      url: BGG_URL(externalId),
    });

    return inserted.id;
  },
};
