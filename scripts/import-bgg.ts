/**
 * Imports BGG collection CSV (`data/collection.csv`) into Supabase.
 * - Upserts items + item_externals + boardgame_details (idempotent).
 * - Then enriches missing cover_url / mechanics / categories by calling BGG /thing.
 *
 * Usage:
 *   npm run import:bgg
 */
import "./_load-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { createAdminClient } from "../src/lib/supabase/admin";
import { bggRatingToTen } from "../src/lib/ratings";
import { bggThings, type BggThing } from "../src/lib/apis/bgg";

type Row = {
  objectname: string;
  objectid: string;
  rating: string;
  numplays: string;
  weight: string;
  own: string;
  yearpublished: string;
  minplayers: string;
  maxplayers: string;
  playingtime: string;
  rank: string;
  bggbestplayers: string;
  originalname: string;
  [k: string]: string;
};

function parseIntMaybe(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFloatMaybe(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseBestPlayers(s: string | undefined): number[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function main() {
  const csvPath = resolve(process.cwd(), "data/collection.csv");
  const csv = readFileSync(csvPath, "utf-8");
  const { data, errors } = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length) {
    console.warn("CSV parse warnings:", errors.slice(0, 3));
  }

  const supabase = createAdminClient();
  console.log(`Parsed ${data.length} rows from ${csvPath}`);

  // Phase 1: upsert items + externals + details
  for (const row of data) {
    if (!row.objectid || !row.objectname) continue;

    const rating = bggRatingToTen(row.rating);
    const playCount = Number(row.numplays) || 0;
    const status = row.own === "1" ? "owned" : null;
    const year = parseIntMaybe(row.yearpublished);

    // Upsert item by (source, external_id) — find existing first
    const { data: existing } = await supabase
      .from("item_externals")
      .select("item_id")
      .eq("source", "bgg")
      .eq("external_id", row.objectid)
      .maybeSingle();

    let itemId: string;

    if (existing?.item_id) {
      itemId = existing.item_id;
      await supabase
        .from("items")
        .update({
          title: row.objectname,
          original_title: row.originalname || null,
          year,
          rating,
          play_count: playCount,
          status,
        })
        .eq("id", itemId);
    } else {
      const { data: inserted, error } = await supabase
        .from("items")
        .insert({
          category: "boardgame",
          title: row.objectname,
          original_title: row.originalname || null,
          year,
          rating,
          play_count: playCount,
          status,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        console.error("Insert failed:", row.objectname, error?.message);
        continue;
      }
      itemId = inserted.id;
      await supabase.from("item_externals").insert({
        item_id: itemId,
        source: "bgg",
        external_id: row.objectid,
        url: `https://boardgamegeek.com/boardgame/${row.objectid}`,
      });
    }

    await supabase.from("boardgame_details").upsert({
      item_id: itemId,
      min_players: parseIntMaybe(row.minplayers),
      max_players: parseIntMaybe(row.maxplayers),
      playing_time_min: parseIntMaybe(row.playingtime),
      weight: parseFloatMaybe(row.weight),
      bgg_rank: parseIntMaybe(row.rank),
      best_players: parseBestPlayers(row.bggbestplayers),
    });
  }

  console.log(`Base import done (${data.length} rows).`);

  // Phase 2: enrich items missing cover_url via BGG /thing (batches of 20)
  const { data: missing } = await supabase
    .from("items")
    .select("id, item_externals!inner(external_id, source)")
    .eq("category", "boardgame")
    .is("cover_url", null);

  const batches: Array<Array<{ id: string; externalId: string }>> = [];
  let batch: Array<{ id: string; externalId: string }> = [];
  for (const item of (missing ?? []) as Array<{
    id: string;
    item_externals: Array<{ external_id: string; source: string }>;
  }>) {
    const bgg = item.item_externals.find((e) => e.source === "bgg");
    if (!bgg) continue;
    batch.push({ id: item.id, externalId: bgg.external_id });
    if (batch.length === 20) {
      batches.push(batch);
      batch = [];
    }
  }
  if (batch.length) batches.push(batch);

  console.log(`Enriching ${batches.reduce((a, b) => a + b.length, 0)} items via BGG...`);

  for (const b of batches) {
    const things = await bggThings(b.map((x) => x.externalId));
    const byId = new Map<string, BggThing>(things.map((t) => [t.id, t]));
    for (const entry of b) {
      const t = byId.get(entry.externalId);
      if (!t) continue;
      await supabase
        .from("items")
        .update({
          cover_url: t.image ?? t.thumbnail ?? null,
        })
        .eq("id", entry.id);
      await supabase.from("boardgame_details").upsert({
        item_id: entry.id,
        min_players: t.minPlayers,
        max_players: t.maxPlayers,
        playing_time_min: t.playingTimeMin,
        weight: t.weight,
        bgg_rank: t.bggRank,
        mechanics: t.mechanics,
        categories: t.categories,
      });
      await supabase.from("item_metadata").upsert({
        item_id: entry.id,
        data: t.raw as object,
        fetched_at: new Date().toISOString(),
      });
    }
    // be gentle to BGG
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
