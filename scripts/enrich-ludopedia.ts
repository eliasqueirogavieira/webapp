/**
 * Pulls EVERYTHING about Elias's board game collection from Ludopedia and
 * caches it locally. This is the source of truth for board games — the BGG
 * CSV is no longer read.
 *
 * Output: data/preview-boardgames.json keyed by `ludo-<id_jogo>`:
 *   {
 *     "ludo-13494": {
 *       "id_jogo": 13494,
 *       "name": "Brass: Birmingham",
 *       "year": 2018,
 *       "cover_url": "https://storage.googleapis.com/.../13494.jpg",
 *       "ludopedia_url": "https://ludopedia.com.br/jogo/...",
 *       "rating": 8.5,
 *       "play_count": 2,
 *       "owned": true,
 *       "wishlist": false,
 *       "favorite": false,
 *       "comment": null,
 *       "cost": 700,
 *       "min_players": 2,
 *       "max_players": 4,
 *       "playing_time_min": 120,
 *       "age_min": 14,
 *       "designers": ["..."],
 *       "artists": ["..."],
 *       "themes": ["..."],
 *       "mechanics": ["..."],
 *       "plays": [<LudopediaPartida...>],
 *       "fetched_at": "..."
 *     }
 *   }
 *
 * Usage:
 *   npm run enrich:boardgames                  # incremental (skip already-cached)
 *   npm run enrich:boardgames -- --force       # refetch every game from scratch
 */
import "./_load-env";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  ludopediaCollection,
  ludopediaGame,
  ludopediaPlays,
  type LudopediaColecaoRow,
  type LudopediaJogo,
  type LudopediaPartida,
} from "../src/lib/apis/ludopedia";

const OWNER_USER_ID = 115441;

export type BoardgameRecord = {
  id_jogo: number;
  name: string;
  year: number | null;
  cover_url: string | null;
  ludopedia_url: string | null;
  rating: number | null;
  play_count: number;
  owned: boolean;
  played: boolean;
  wishlist: boolean;
  favorite: boolean;
  comment: string | null;
  cost: number | null;
  min_players: number | null;
  max_players: number | null;
  playing_time_min: number | null;
  age_min: number | null;
  designers: string[];
  artists: string[];
  themes: string[];
  mechanics: string[];
  plays: LudopediaPartida[];
  fetched_at: string;
};

type Store = Record<string, BoardgameRecord>;

const path = resolve(process.cwd(), "data/preview-boardgames.json");

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

function upgradeCover(thumbUrl: string | undefined): string | null {
  // Ludopedia thumbs are like .../<id>_t.jpg; stripping `_t` gives the full size.
  if (!thumbUrl) return null;
  return thumbUrl.replace(/_t(\.[a-z]+)(\?.*)?$/i, "$1$2");
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  if (!process.env.LUDOPEDIA_TOKEN) {
    console.error("LUDOPEDIA_TOKEN missing in .env.local — aborting.");
    process.exit(1);
  }

  console.log("Fetching collection...");
  const collection = await ludopediaCollection(OWNER_USER_ID);
  console.log(`Collection: ${collection.length} games.`);

  const store = force ? {} : load();

  let detailFetches = 0;
  let playsFetches = 0;
  for (let i = 0; i < collection.length; i++) {
    const c: LudopediaColecaoRow = collection[i];
    const key = `ludo-${c.id_jogo}`;
    const existing = store[key];
    const needsRefresh = force || !existing;

    let detail: LudopediaJogo | null = null;
    let plays: LudopediaPartida[] = existing?.plays ?? [];
    let fetched = existing?.fetched_at ?? new Date().toISOString();

    if (needsRefresh) {
      detail = await ludopediaGame(c.id_jogo);
      detailFetches++;
      await sleep(1100);
      plays = await ludopediaPlays(c.id_jogo);
      playsFetches++;
      await sleep(1100);
      fetched = new Date().toISOString();
    }

    // Always overwrite "personal" fields from the latest /colecao snapshot —
    // the user's rating/play count/ownership can change without re-fetching detail.
    const record: BoardgameRecord = {
      id_jogo: c.id_jogo,
      name: c.nm_jogo,
      year: detail?.ano_publicacao ?? null,
      cover_url: upgradeCover(c.thumb) ?? upgradeCover(detail?.thumb),
      ludopedia_url: c.link
        ? c.link.startsWith("http")
          ? c.link
          : `https://ludopedia.com.br/${c.link.replace(/^\//, "")}`
        : null,
      rating: c.vl_nota,
      play_count: c.qt_partidas ?? 0,
      owned: c.fl_tem === 1,
      played: c.fl_jogou === 1,
      wishlist: c.fl_quer === 1,
      favorite: c.fl_favorito === 1,
      comment: c.comentario,
      cost: c.vl_custo,
      min_players: detail?.qt_jogadores_min ?? null,
      max_players: detail?.qt_jogadores_max ?? null,
      playing_time_min: detail?.vl_tempo_jogo ?? null,
      age_min: detail?.idade_minima ?? null,
      designers: detail?.designers?.map((p) => p.nm_profissional)
        ?? existing?.designers ?? [],
      artists: detail?.artistas?.map((p) => p.nm_profissional)
        ?? existing?.artists ?? [],
      themes: detail?.temas?.map((t) => t.nm_tema) ?? existing?.themes ?? [],
      mechanics: detail?.mecanicas?.map((m) => m.nm_mecanica)
        ?? existing?.mechanics ?? [],
      plays,
      fetched_at: fetched,
    };
    store[key] = record;

    if (i % 3 === 0) save(store);
    process.stdout.write(
      `  ${i + 1}/${collection.length}  detail=${detailFetches} plays=${playsFetches}\r`,
    );
  }
  save(store);
  console.log(
    `\nDone. ${collection.length} games, ${detailFetches} detail fetches, ${playsFetches} plays fetches.`,
  );
  console.log(`Written to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
