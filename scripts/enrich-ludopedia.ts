/**
 * Pulls richer Ludopedia data — full game detail + the user's plays — for every
 * board game in data/collection.csv. Writes to data/preview-ludopedia.json.
 *
 * Output shape (keyed by `bgg-<objectid>`):
 *   {
 *     "bgg-224517": {
 *       "ludopedia_id": 13494,
 *       "ludopedia_url": "https://ludopedia.com.br/jogo/...",
 *       "detail": <full /jogos/{id} response>,
 *       "plays":  <array of /partidas entries, latest first>,
 *       "fetched_at": "2026-04-24T..."
 *     }
 *   }
 *
 * Usage:
 *   npm run enrich:ludopedia                   # only fetch what's missing
 *   npm run enrich:ludopedia -- --force        # refetch everything
 */
import "./_load-env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import {
  ludopediaGame,
  ludopediaPlays,
  ludopediaSearch,
  pickBestLudopediaMatch,
  type LudopediaJogo,
  type LudopediaPartida,
} from "../src/lib/apis/ludopedia";

type Entry = {
  ludopedia_id: number;
  ludopedia_url: string | null;
  detail: LudopediaJogo | null;
  plays: LudopediaPartida[];
  fetched_at: string;
};
type Store = Record<string, Entry>;

const path = resolve(process.cwd(), "data/preview-ludopedia.json");

function load(): Store {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Store;
  } catch {
    return {};
  }
}

function save(s: Store) {
  writeFileSync(path, JSON.stringify(s, null, 2) + "\n", "utf-8");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  if (!process.env.LUDOPEDIA_TOKEN) {
    console.error("LUDOPEDIA_TOKEN not set in .env.local — aborting.");
    process.exit(1);
  }

  const csv = readFileSync(resolve(process.cwd(), "data/collection.csv"), "utf-8");
  const { data } = Papa.parse<{
    objectid: string;
    objectname: string;
    yearpublished: string;
  }>(csv, { header: true, skipEmptyLines: true });
  const rows = data.filter((r) => r.objectid && r.objectname);

  const store = load();
  if (force) {
    console.log("--force: refetching everything.");
    for (const k of Object.keys(store)) delete store[k];
    save(store);
  }

  const todo = rows.filter((r) => !store[`bgg-${r.objectid}`]);
  console.log(`Ludopedia detail+plays: ${todo.length} games to fetch (of ${rows.length}).`);

  let hits = 0;
  let misses = 0;
  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    try {
      const results = await ludopediaSearch(r.objectname);
      const year = Number(r.yearpublished) || null;
      const best = pickBestLudopediaMatch(r.objectname, year, results);
      if (!best) {
        misses++;
      } else {
        await sleep(1100);
        const detail = await ludopediaGame(best.id_jogo);
        await sleep(1100);
        const plays = await ludopediaPlays(best.id_jogo);
        store[`bgg-${r.objectid}`] = {
          ludopedia_id: best.id_jogo,
          ludopedia_url:
            best.link
              ? best.link.startsWith("http")
                ? best.link
                : `https://ludopedia.com.br/${best.link.replace(/^\//, "")}`
              : null,
          detail,
          plays,
          fetched_at: new Date().toISOString(),
        };
        hits++;
      }
    } catch (err) {
      misses++;
      console.warn(`  skipped "${r.objectname}": ${(err as Error).message}`);
    }
    if (i % 3 === 0) save(store);
    process.stdout.write(`  ${i + 1}/${todo.length}  hit=${hits} miss=${misses}\r`);
    await sleep(1100);
  }
  save(store);
  console.log(`\nDone. ${hits} games enriched, ${misses} misses.`);
  console.log(`Written to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
