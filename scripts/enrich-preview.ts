/**
 * Fetches covers for every item in the CSVs and writes them to
 * `data/preview-covers.json`. Preview mode reads this file to show covers
 * without needing Supabase at all.
 *
 * BGG covers work with zero setup.
 * IGDB covers need TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET in .env.local
 * (free from https://dev.twitch.tv/console/apps).
 *
 * Usage:
 *   npm run enrich:preview            # does both (skips IGDB if creds missing)
 *   npm run enrich:preview -- --bgg   # only board games
 *   npm run enrich:preview -- --igdb  # only video games
 */
import "./_load-env";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { bggThings } from "../src/lib/apis/bgg";
import { igdbByIds, igdbCoverUrl } from "../src/lib/apis/igdb";
import {
  ludopediaSearch,
  pickBestLudopediaMatch,
  upgradeLudopediaCover,
} from "../src/lib/apis/ludopedia";

type CoverMap = Record<string, string>;

const coversPath = resolve(process.cwd(), "data/preview-covers.json");

function loadExisting(): CoverMap {
  if (!existsSync(coversPath)) return {};
  try {
    return JSON.parse(readFileSync(coversPath, "utf-8")) as CoverMap;
  } catch {
    return {};
  }
}

function save(map: CoverMap) {
  writeFileSync(coversPath, JSON.stringify(map, null, 2) + "\n", "utf-8");
}

async function enrichBgg(existing: CoverMap) {
  const csvPath = resolve(process.cwd(), "data/collection.csv");
  if (!existsSync(csvPath)) {
    console.log("No data/collection.csv — skipping BGG.");
    return;
  }
  if (!process.env.BGG_AUTH_TOKEN) {
    console.log(
      "BGG: BGG_AUTH_TOKEN not set — skipping. BGG now requires a registered application token.",
    );
    console.log(
      "     Apply at https://boardgamegeek.com/applications (approval can take up to a week).",
    );
    return;
  }
  const csv = readFileSync(csvPath, "utf-8");
  const { data } = Papa.parse<{ objectid: string; objectname: string }>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const ids = data
    .map((r) => r.objectid)
    .filter((id) => id && !existing[`bgg-${id}`]);

  if (ids.length === 0) {
    console.log("BGG: all covers already cached.");
    return;
  }
  console.log(`BGG: fetching ${ids.length} covers (batches of 20)...`);

  for (let i = 0; i < ids.length; i += 20) {
    const batch = ids.slice(i, i + 20);
    const things = await bggThings(batch);
    for (const t of things) {
      const url = t.image ?? t.thumbnail;
      if (url) existing[`bgg-${t.id}`] = url;
    }
    save(existing);
    process.stdout.write(`  ${Math.min(i + 20, ids.length)}/${ids.length}\r`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log("\nBGG: done.");
}

async function enrichIgdb(existing: CoverMap) {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    console.log(
      "IGDB: TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set in .env.local — skipping.",
    );
    console.log(
      "     Register a free app at https://dev.twitch.tv/console/apps to enable.",
    );
    return;
  }

  const dataDir = resolve(process.cwd(), "data");
  const file = readdirSync(dataDir)
    .filter((f) => f.includes("grouvee") && f.endsWith(".csv"))
    .sort()
    .pop();
  if (!file) {
    console.log("No grouvee CSV — skipping IGDB.");
    return;
  }
  const csv = readFileSync(resolve(dataDir, file), "utf-8");
  const { data } = Papa.parse<{ id: string; igdb_id: string; name: string }>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  const needed = data
    .filter((r) => r.id && r.igdb_id && !existing[`grouvee-${r.id}`])
    .map((r) => ({ grouveeId: r.id, igdbId: r.igdb_id }));

  if (needed.length === 0) {
    console.log("IGDB: all covers already cached.");
    return;
  }
  console.log(`IGDB: fetching ${needed.length} covers (batches of 10)...`);

  for (let i = 0; i < needed.length; i += 10) {
    const batch = needed.slice(i, i + 10);
    const games = await igdbByIds(batch.map((x) => x.igdbId));
    const byId = new Map<number, { cover?: { image_id: string } }>(
      games.map((g) => [g.id, g]),
    );
    for (const entry of batch) {
      const g = byId.get(Number(entry.igdbId));
      if (g?.cover?.image_id) {
        existing[`grouvee-${entry.grouveeId}`] = igdbCoverUrl(g.cover.image_id);
      }
    }
    save(existing);
    process.stdout.write(`  ${Math.min(i + 10, needed.length)}/${needed.length}\r`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log("\nIGDB: done.");
}

function forgetSteamEntries(map: CoverMap): number {
  let n = 0;
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string" && v.includes("steamstatic.com")) {
      delete map[k];
      n++;
    }
  }
  return n;
}

function forgetIgdbEntries(map: CoverMap): number {
  let n = 0;
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string" && v.includes("images.igdb.com")) {
      delete map[k];
      n++;
    }
  }
  return n;
}

async function validateCovers(map: CoverMap): Promise<number> {
  const entries = Object.entries(map);
  console.log(`Validating ${entries.length} cached cover URLs...`);
  let removed = 0;
  // HEAD in parallel batches of 20 to keep it fast.
  for (let i = 0; i < entries.length; i += 20) {
    const batch = entries.slice(i, i + 20);
    const results = await Promise.all(
      batch.map(async ([k, url]) => {
        try {
          const res = await fetch(url, { method: "HEAD" });
          return { k, ok: res.ok, status: res.status };
        } catch {
          return { k, ok: false, status: 0 };
        }
      }),
    );
    for (const r of results) {
      if (!r.ok) {
        delete map[r.k];
        removed++;
        console.log(`  drop ${r.k} (${r.status})`);
      }
    }
    process.stdout.write(`  ${Math.min(i + 20, entries.length)}/${entries.length}\r`);
  }
  console.log(`\nValidate: removed ${removed} broken URLs.`);
  return removed;
}

async function enrichLudopedia(existing: CoverMap) {
  const csvPath = resolve(process.cwd(), "data/collection.csv");
  if (!existsSync(csvPath)) {
    console.log("No data/collection.csv — skipping Ludopedia.");
    return;
  }
  if (!process.env.LUDOPEDIA_TOKEN) {
    console.log(
      "Ludopedia: LUDOPEDIA_TOKEN not set — skipping. Generate one at https://ludopedia.com.br/configuracoes/api.",
    );
    return;
  }
  const csv = readFileSync(csvPath, "utf-8");
  const { data } = Papa.parse<{
    objectid: string;
    objectname: string;
    yearpublished: string;
  }>(csv, { header: true, skipEmptyLines: true });
  const needed = data.filter((r) => r.objectid && r.objectname && !existing[`bgg-${r.objectid}`]);

  if (needed.length === 0) {
    console.log("Ludopedia: all covers already cached.");
    return;
  }
  console.log(`Ludopedia: searching ${needed.length} titles...`);

  let hits = 0;
  let misses = 0;
  for (let i = 0; i < needed.length; i++) {
    const row = needed[i];
    const year = Number(row.yearpublished) || null;
    try {
      const results = await ludopediaSearch(row.objectname);
      const best = pickBestLudopediaMatch(row.objectname, year, results);
      const cover = upgradeLudopediaCover(best?.thumb);
      if (cover) {
        existing[`bgg-${row.objectid}`] = cover;
        hits++;
      } else {
        misses++;
      }
    } catch (err) {
      misses++;
      console.warn(`  skipped "${row.objectname}": ${(err as Error).message}`);
    }
    if (i % 5 === 0) save(existing);
    process.stdout.write(
      `  ${i + 1}/${needed.length}  hit=${hits} miss=${misses}\r`,
    );
    // Ludopedia's rate limit is strict — 1s/req is the safe pace.
    await new Promise((r) => setTimeout(r, 1100));
  }
  save(existing);
  console.log(`\nLudopedia: done. ${hits} covers, ${misses} misses.`);
}

async function main() {
  const args = process.argv.slice(2);
  const onlyBgg = args.includes("--bgg");
  const onlyIgdb = args.includes("--igdb");
  const onlyLudo = args.includes("--ludo") || args.includes("--ludopedia");
  const onlyValidate = args.includes("--validate");
  const force = args.includes("--force");

  const existing = loadExisting();

  if (onlyValidate) {
    await validateCovers(existing);
    save(existing);
    return;
  }

  // Always drop any leftover Steam URLs — Steam was removed because its CDN
  // returns small grayscale placeholders for unreleased games and the
  // detail/cover quality varies wildly. IGDB is the standard for video games.
  const dropped = forgetSteamEntries(existing);
  if (dropped > 0) {
    console.log(`Cleared ${dropped} legacy Steam entries.`);
    save(existing);
  }
  if (force && (onlyIgdb || (!onlyBgg && !onlyLudo))) {
    const n = forgetIgdbEntries(existing);
    if (n > 0) console.log(`--force: cleared ${n} IGDB entries to re-match.`);
    save(existing);
  }
  const before = Object.keys(existing).length;

  // Default: try every source, gated on creds. Sources that lack env vars skip silently.
  //   Videogames: IGDB (Twitch creds) — single source of truth.
  //   Boardgames: Ludopedia (personal token) → BGG (approved app token).
  if (onlyBgg) {
    await enrichBgg(existing);
  } else if (onlyIgdb) {
    await enrichIgdb(existing);
  } else if (onlyLudo) {
    await enrichLudopedia(existing);
  } else {
    await enrichIgdb(existing);
    await enrichLudopedia(existing);
    await enrichBgg(existing);
  }

  save(existing);
  const after = Object.keys(existing).length;
  console.log(`Cached covers: ${after} total (+${after - before} new).`);
  console.log(`Written to ${coversPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
