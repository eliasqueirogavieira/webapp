"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/auth";
import { bggSearch, bggThings } from "@/lib/apis/bgg";
import {
  igdbByIds,
  igdbCoverUrl,
  igdbReleaseDate,
  igdbSearch,
  igdbSplitCompanies,
} from "@/lib/apis/igdb";

export async function searchBgg(query: string) {
  if (!(await isOwner())) throw new Error("Unauthorized");
  if (query.trim().length < 2) return [];
  return bggSearch(query);
}

export async function searchIgdb(query: string) {
  if (!(await isOwner())) throw new Error("Unauthorized");
  if (query.trim().length < 2) return [];
  return igdbSearch(query, 12);
}

export async function addBoardgame(bggId: string): Promise<string> {
  if (!(await isOwner())) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("item_externals")
    .select("item_id")
    .eq("source", "bgg")
    .eq("external_id", bggId)
    .maybeSingle();
  if (existing?.item_id) {
    revalidatePath("/boardgames");
    redirect(`/boardgames/${existing.item_id}`);
  }

  const [thing] = await bggThings([bggId]);
  if (!thing) throw new Error(`BGG id ${bggId} not found`);

  const { data: inserted, error } = await supabase
    .from("items")
    .insert({
      category: "boardgame",
      title: thing.name,
      year: thing.year,
      cover_url: thing.image ?? thing.thumbnail,
    })
    .select("id")
    .single();
  if (error || !inserted) throw error ?? new Error("Insert failed");

  await supabase.from("item_externals").insert({
    item_id: inserted.id,
    source: "bgg",
    external_id: bggId,
    url: `https://boardgamegeek.com/boardgame/${bggId}`,
  });
  await supabase.from("boardgame_details").insert({
    item_id: inserted.id,
    min_players: thing.minPlayers,
    max_players: thing.maxPlayers,
    playing_time_min: thing.playingTimeMin,
    weight: thing.weight,
    bgg_rank: thing.bggRank,
    mechanics: thing.mechanics,
    categories: thing.categories,
  });
  await supabase.from("item_metadata").insert({
    item_id: inserted.id,
    data: thing.raw as object,
  });

  revalidatePath("/boardgames");
  revalidatePath("/");
  redirect(`/boardgames/${inserted.id}`);
}

export async function addVideogame(igdbId: string): Promise<string> {
  if (!(await isOwner())) throw new Error("Unauthorized");

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("item_externals")
    .select("item_id")
    .eq("source", "igdb")
    .eq("external_id", igdbId)
    .maybeSingle();
  if (existing?.item_id) {
    revalidatePath("/videogames");
    redirect(`/videogames/${existing.item_id}`);
  }

  const [game] = await igdbByIds([igdbId]);
  if (!game) throw new Error(`IGDB id ${igdbId} not found`);

  const { developers, publishers } = igdbSplitCompanies(game);
  const releaseDate = igdbReleaseDate(game);

  const { data: inserted, error } = await supabase
    .from("items")
    .insert({
      category: "videogame",
      title: game.name,
      year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
      cover_url: game.cover?.image_id ? igdbCoverUrl(game.cover.image_id) : null,
    })
    .select("id")
    .single();
  if (error || !inserted) throw error ?? new Error("Insert failed");

  await supabase.from("item_externals").insert({
    item_id: inserted.id,
    source: "igdb",
    external_id: igdbId,
    url: null,
  });
  await supabase.from("videogame_details").insert({
    item_id: inserted.id,
    platforms: game.platforms?.map((p) => p.name) ?? [],
    genres: game.genres?.map((p) => p.name) ?? [],
    developers,
    publishers,
    franchises: game.franchises?.map((f) => f.name) ?? [],
    release_date: releaseDate,
  });
  await supabase.from("item_metadata").insert({
    item_id: inserted.id,
    data: game as unknown as object,
  });

  revalidatePath("/videogames");
  revalidatePath("/");
  redirect(`/videogames/${inserted.id}`);
}

export async function updateRating(itemId: string, rating: number | null) {
  if (!(await isOwner())) throw new Error("Unauthorized");
  const supabase = createAdminClient();
  await supabase.from("items").update({ rating }).eq("id", itemId);
  revalidatePath(`/boardgames/${itemId}`);
  revalidatePath(`/videogames/${itemId}`);
  revalidatePath("/");
}
