/**
 * Imports Grouvee export CSV into Supabase as video games.
 * Rating: Grouvee 1-5 → 0-10 (× 2).
 * Uses `igdb_id` directly when present to skip title matching.
 *
 * Usage:
 *   npm run import:grouvee
 */
import "./_load-env";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { createAdminClient } from "../src/lib/supabase/admin";
import { grouveeRatingToTen } from "../src/lib/ratings";
import {
  igdbByIds,
  igdbCoverUrl,
  igdbReleaseDate,
  igdbSplitCompanies,
  type IgdbGame,
} from "../src/lib/apis/igdb";

type Row = {
  id: string;
  name: string;
  shelves: string;
  platforms: string;
  rating: string;
  genres: string;
  franchises: string;
  developers: string;
  publishers: string;
  release_date: string;
  date_added_to_collection: string;
  url: string;
  igdb_id: string;
  [k: string]: string;
};

function safeJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw || raw === "{}" || raw === "[]") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function namesFromJsonMap(raw: string | undefined): string[] {
  const obj = safeJson<Record<string, unknown>>(raw, {});
  return Object.keys(obj);
}

function statusFromShelves(raw: string | undefined): string | null {
  const keys = namesFromJsonMap(raw).map((k) => k.toLowerCase());
  if (keys.includes("played")) return "played";
  if (keys.includes("playing")) return "backlog";
  if (keys.includes("backlog")) return "backlog";
  if (keys.includes("wishlist")) return "wishlist";
  if (keys.includes("abandoned")) return "abandoned";
  return null;
}

async function main() {
  const dataDir = resolve(process.cwd(), "data");
  // Grouvee filename contains a timestamp; find the latest one
  const grouveeFile = readdirSync(dataDir)
    .filter((f) => f.includes("grouvee") && f.endsWith(".csv"))
    .sort()
    .pop();
  if (!grouveeFile) {
    throw new Error(`No grouvee CSV found in ${dataDir}`);
  }
  const csvPath = resolve(dataDir, grouveeFile);
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

  // Phase 1: base upsert using CSV data only
  const itemsByIgdbId = new Map<string, string>(); // igdb_id -> item_id
  const itemsByGrouveeId = new Map<string, string>(); // grouvee id -> item_id

  for (const row of data) {
    if (!row.id || !row.name) continue;

    const rating = grouveeRatingToTen(row.rating);
    const platforms = namesFromJsonMap(row.platforms);
    const genres = namesFromJsonMap(row.genres);
    const franchises = namesFromJsonMap(row.franchises);
    const developers = namesFromJsonMap(row.developers);
    const publishers = namesFromJsonMap(row.publishers);
    const status = statusFromShelves(row.shelves);
    const year = row.release_date ? Number(row.release_date.slice(0, 4)) : null;

    // Prefer matching by IGDB id, fall back to Grouvee id
    const keySource = row.igdb_id ? "igdb" : "grouvee";
    const keyId = row.igdb_id || row.id;

    const { data: existing } = await supabase
      .from("item_externals")
      .select("item_id")
      .eq("source", keySource)
      .eq("external_id", keyId)
      .maybeSingle();

    let itemId: string;

    if (existing?.item_id) {
      itemId = existing.item_id;
      await supabase
        .from("items")
        .update({
          title: row.name,
          year: Number.isFinite(year) && year! > 0 ? year : null,
          rating,
          status,
        })
        .eq("id", itemId);
    } else {
      const { data: inserted, error } = await supabase
        .from("items")
        .insert({
          category: "videogame",
          title: row.name,
          year: Number.isFinite(year) && year! > 0 ? year : null,
          rating,
          status,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        console.error("Insert failed:", row.name, error?.message);
        continue;
      }
      itemId = inserted.id;
    }

    // externals: always store Grouvee id, and IGDB id when present
    await supabase.from("item_externals").upsert(
      [
        {
          item_id: itemId,
          source: "grouvee",
          external_id: row.id,
          url: row.url || null,
        },
        ...(row.igdb_id
          ? [
              {
                item_id: itemId,
                source: "igdb",
                external_id: row.igdb_id,
                url: null,
              },
            ]
          : []),
      ],
      { onConflict: "item_id,source" },
    );

    await supabase.from("videogame_details").upsert({
      item_id: itemId,
      platforms,
      genres,
      franchises,
      developers,
      publishers,
      release_date: row.release_date || null,
    });

    if (row.igdb_id) itemsByIgdbId.set(row.igdb_id, itemId);
    itemsByGrouveeId.set(row.id, itemId);
  }

  console.log(`Base import done (${data.length} rows).`);

  // Phase 2: enrich with IGDB data (covers, canonical metadata)
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.log("TWITCH_CLIENT_ID/SECRET not set — skipping IGDB enrichment.");
    return;
  }

  const { data: missing } = await supabase
    .from("items")
    .select("id, item_externals!inner(external_id, source)")
    .eq("category", "videogame")
    .is("cover_url", null);

  const enrichList: Array<{ id: string; igdbId: string }> = [];
  for (const item of (missing ?? []) as Array<{
    id: string;
    item_externals: Array<{ external_id: string; source: string }>;
  }>) {
    const igdb = item.item_externals.find((e) => e.source === "igdb");
    if (igdb) enrichList.push({ id: item.id, igdbId: igdb.external_id });
  }

  console.log(`Enriching ${enrichList.length} video games via IGDB...`);

  for (let i = 0; i < enrichList.length; i += 10) {
    const batch = enrichList.slice(i, i + 10);
    const games = await igdbByIds(batch.map((x) => x.igdbId));
    const byId = new Map<number, IgdbGame>(games.map((g) => [g.id, g]));
    for (const entry of batch) {
      const g = byId.get(Number(entry.igdbId));
      if (!g) continue;
      const { developers, publishers } = igdbSplitCompanies(g);
      await supabase
        .from("items")
        .update({
          cover_url: g.cover?.image_id
            ? igdbCoverUrl(g.cover.image_id)
            : null,
        })
        .eq("id", entry.id);
      await supabase.from("videogame_details").upsert({
        item_id: entry.id,
        platforms: g.platforms?.map((p) => p.name) ?? [],
        genres: g.genres?.map((p) => p.name) ?? [],
        developers,
        publishers,
        franchises: g.franchises?.map((f) => f.name) ?? [],
        release_date: igdbReleaseDate(g),
      });
      await supabase.from("item_metadata").upsert({
        item_id: entry.id,
        data: g as unknown as object,
        fetched_at: new Date().toISOString(),
      });
    }
    // IGDB rate limit is 4/s; sleep ~1.2s between batches
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
