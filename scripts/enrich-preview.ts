/**
 * Fetches video game cover URLs from IGDB and writes them to
 * `data/preview-covers.json`. Board game covers are no longer handled here —
 * they live in data/preview-boardgames.json next to the rest of the
 * Ludopedia-sourced board game data.
 *
 * IGDB covers need TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET in .env.local
 * (free from https://dev.twitch.tv/console/apps).
 *
 * Usage:
 *   npm run enrich:preview                     # incremental
 *   npm run enrich:preview -- --validate       # HEAD-check every URL, drop 404s
 *   npm run enrich:preview -- --force          # refetch all IGDB covers
 */
import "./_load-env";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import {
  igdbByIds,
  igdbCoverUrl,
  type IgdbGame,
} from "../src/lib/apis/igdb";

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

/** Drop any leftover non-`grouvee-` keys (Steam, BGG, Ludopedia legacy entries). */
function pruneNonVideogameEntries(map: CoverMap): number {
  let n = 0;
  for (const k of Object.keys(map)) {
    if (!k.startsWith("grouvee-")) {
      delete map[k];
      n++;
    }
  }
  return n;
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
    const byId = new Map<number, IgdbGame>(games.map((g) => [g.id, g]));
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

async function validateCovers(map: CoverMap): Promise<number> {
  const entries = Object.entries(map);
  console.log(`Validating ${entries.length} cached cover URLs...`);
  let removed = 0;
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

async function main() {
  const args = process.argv.slice(2);
  const onlyValidate = args.includes("--validate");
  const force = args.includes("--force");

  const existing = loadExisting();

  if (onlyValidate) {
    await validateCovers(existing);
    save(existing);
    return;
  }

  // Drop any non-videogame entries (Steam, BGG, Ludopedia covers we used to
  // mix into this file). Idempotent — safe to re-run.
  const pruned = pruneNonVideogameEntries(existing);
  if (pruned > 0) {
    console.log(`Pruned ${pruned} legacy entries (only grouvee-* keys belong here now).`);
    save(existing);
  }

  if (force) {
    let n = 0;
    for (const k of Object.keys(existing)) {
      delete existing[k];
      n++;
    }
    console.log(`--force: cleared ${n} existing entries.`);
    save(existing);
  }
  const before = Object.keys(existing).length;

  await enrichIgdb(existing);

  save(existing);
  const after = Object.keys(existing).length;
  console.log(`Cached covers: ${after} total (+${after - before} new).`);
  console.log(`Written to ${coversPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
