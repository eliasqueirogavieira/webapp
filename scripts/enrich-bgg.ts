/**
 * Pulls the user's BGG collection and per-game metadata into a local cache.
 *
 * Output: data/preview-bgg.json keyed by `bgg-<objectid>` with both the
 * collection-level row (status flags, wishlist priority, acquisition date when
 * available) and the /thing payload (rank, weight, mechanics, designers).
 *
 * Usage:
 *   npm run enrich:bgg                  # incremental — refresh collection,
 *                                       # only fetch /thing for new ids
 *   npm run enrich:bgg -- --force       # refetch every /thing payload
 */
import "./_load-env";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  bggCollection,
  bggThings,
  type BggCollectionRow,
  type BggThing,
} from "../src/lib/apis/bgg";

export type BggCachedRow = {
  collection: BggCollectionRow;
  thing: BggThing | null;
  fetched_at: string;
};

type Store = Record<string, BggCachedRow>;

const path = resolve(process.cwd(), "data/preview-bgg.json");

function load(): Store {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Store;
  } catch {
    return {};
  }
}

function save(s: Store) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(s, null, 2) + "\n", "utf-8");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THING_BATCH = 20;

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  const username = process.env.BGG_USERNAME;
  if (!username) {
    console.error("BGG_USERNAME missing in env — aborting.");
    process.exit(1);
  }
  if (!process.env.BGG_AUTH_TOKEN) {
    console.error("BGG_AUTH_TOKEN missing in env — aborting.");
    process.exit(1);
  }
  if (!process.env.BGG_PASSWORD) {
    console.warn(
      "BGG_PASSWORD not set — will fetch the collection without <privateinfo>. " +
        "Acquisition dates will be empty until you set it.",
    );
  }

  console.log(`Fetching BGG collection for ${username}...`);
  const collection = await bggCollection(username);
  console.log(
    `Collection: ${collection.length} entries (` +
      `${collection.filter((r) => r.status.own).length} owned, ` +
      `${collection.filter((r) => r.status.wishlist).length} wishlist, ` +
      `${collection.filter((r) => r.privateinfo?.acquisitiondate).length} with acquisition date).`,
  );

  // Skip expansions / accessories on first pass — they bloat the matcher and
  // we're not surfacing them in the UI yet.
  const filtered = collection.filter((r) => r.subtype === "boardgame");
  if (filtered.length < collection.length) {
    console.log(`  → ${collection.length - filtered.length} expansions/accessories skipped.`);
  }

  const store = load();
  const idsNeedingThing: string[] = [];
  for (const row of filtered) {
    const key = `bgg-${row.id}`;
    const existing = store[key];
    const needsThing = force || !existing?.thing;
    if (needsThing) idsNeedingThing.push(row.id);
    store[key] = {
      collection: row,
      thing: existing?.thing ?? null,
      fetched_at: existing?.fetched_at ?? new Date().toISOString(),
    };
  }

  console.log(`Fetching /thing for ${idsNeedingThing.length} ids...`);
  let done = 0;
  for (let i = 0; i < idsNeedingThing.length; i += THING_BATCH) {
    const batch = idsNeedingThing.slice(i, i + THING_BATCH);
    const things = await bggThings(batch);
    const byId = new Map(things.map((t) => [t.id, t]));
    for (const id of batch) {
      const key = `bgg-${id}`;
      if (store[key]) {
        store[key] = {
          ...store[key],
          thing: byId.get(id) ?? null,
          fetched_at: new Date().toISOString(),
        };
      }
    }
    done += batch.length;
    save(store);
    process.stdout.write(`  ${done}/${idsNeedingThing.length}\r\x1b[K`);
    await sleep(1100);
  }

  // Drop entries that fell out of the collection since last run.
  const liveKeys = new Set(filtered.map((r) => `bgg-${r.id}`));
  for (const key of Object.keys(store)) {
    if (!liveKeys.has(key)) delete store[key];
  }

  save(store);
  console.log(`\nDone. Wrote ${Object.keys(store).length} entries to ${path}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
