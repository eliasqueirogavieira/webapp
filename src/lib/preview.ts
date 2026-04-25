/**
 * Preview mode: load the user's collection from local JSON caches that the
 * enrichment scripts produce. Activated with PREVIEW_MODE=1.
 *
 *   • Board games come from data/preview-boardgames.json (Ludopedia API)
 *   • Video games come from data/oktano_*_grouvee_*.csv + data/preview-covers.json
 *     (until we move them into Supabase)
 */
import "server-only";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { grouveeRatingToTen } from "./ratings";
import type { LudopediaPartida } from "./apis/ludopedia";
import type { ItemCardData } from "@/components/ItemCard";

type BoardgameRecord = {
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

function loadBoardgameStore(): Record<string, BoardgameRecord> {
  const p = resolve(process.cwd(), "data/preview-boardgames.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

// Video game covers produced by `npm run enrich:preview`, keyed by `grouvee-<id>`.
// (Board game covers now ship inside data/preview-boardgames.json.)
function loadCovers(): Record<string, string> {
  const path = resolve(process.cwd(), "data/preview-covers.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

export function isPreviewMode() {
  return process.env.PREVIEW_MODE === "1";
}

type GrouveeRow = {
  id: string;
  name: string;
  rating: string;
  release_date: string;
  igdb_id: string;
  url: string;
  platforms: string;
  genres: string;
  developers: string;
  publishers: string;
  franchises: string;
  shelves: string;
};

function safeParseCsv<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const csv = readFileSync(path, "utf-8");
  const { data } = Papa.parse<T>(csv, { header: true, skipEmptyLines: true });
  return data;
}

function parseYear(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).slice(0, 4));
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

function namesFromJsonMap(raw: string | undefined): string[] {
  if (!raw || raw === "{}") return [];
  try {
    return Object.keys(JSON.parse(raw));
  } catch {
    return [];
  }
}

function statusFromShelves(raw: string | undefined): string | null {
  const keys = namesFromJsonMap(raw).map((k) => k.toLowerCase());
  if (keys.includes("played")) return "played";
  if (keys.includes("playing") || keys.includes("backlog")) return "backlog";
  if (keys.includes("wishlist")) return "wishlist";
  if (keys.includes("abandoned")) return "abandoned";
  return null;
}

// --- Board games -----------------------------------------------------------

export type BoardgameDetail = {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  cover_url: string | null;
  play_count: number;
  status: string | null;
  notes: null;
  min_players: number | null;
  max_players: number | null;
  playing_time_min: number | null;
  age_min: number | null;
  mechanics: string[];
  designers: string[];
  artists: string[];
  themes: string[];
  ludopedia_id: number | null;
  ludopedia_url: string | null;
  cost: number | null;
  comment: string | null;
  // Plays come from Ludopedia /partidas, latest first
  plays: LudopediaPartida[];
};

function statusFromBoardgameRecord(r: BoardgameRecord): string | null {
  if (r.played) return "played";
  if (r.owned) return "owned";
  if (r.wishlist) return "wishlist";
  if (r.favorite) return "favorite";
  return null;
}

export type PlaySummary = {
  total_plays: number;
  total_minutes: number;
  wins: number;
  played_dates: number; // distinct dates
  first_date: string | null;
  last_date: string | null;
};

export function summarizePlays(plays: LudopediaPartida[], userId = 115441): PlaySummary {
  let total_plays = 0;
  let total_minutes = 0;
  let wins = 0;
  const dates = new Set<string>();
  let first: string | null = null;
  let last: string | null = null;
  for (const p of plays) {
    const n = p.qt_partidas || 1;
    total_plays += n;
    if (p.duracao) total_minutes += p.duracao * n;
    const me = p.jogadores.find((j) => j.id_usuario === userId);
    if (me?.fl_vencedor === 1) wins += n;
    dates.add(p.dt_partida);
    if (!first || p.dt_partida < first) first = p.dt_partida;
    if (!last || p.dt_partida > last) last = p.dt_partida;
  }
  return {
    total_plays,
    total_minutes,
    wins,
    played_dates: dates.size,
    first_date: first,
    last_date: last,
  };
}

function buildBoardgameDetail(key: string, r: BoardgameRecord): BoardgameDetail {
  return {
    id: key,
    title: r.name,
    year: r.year,
    rating: r.rating,
    cover_url: r.cover_url,
    play_count: r.play_count,
    status: statusFromBoardgameRecord(r),
    notes: null,
    min_players: r.min_players,
    max_players: r.max_players,
    playing_time_min: r.playing_time_min,
    age_min: r.age_min,
    mechanics: r.mechanics,
    designers: r.designers,
    artists: r.artists,
    themes: r.themes,
    ludopedia_id: r.id_jogo,
    ludopedia_url: r.ludopedia_url,
    cost: r.cost,
    comment: r.comment,
    plays: r.plays,
  };
}

export function getPreviewBoardgames(): ItemCardData[] {
  const store = loadBoardgameStore();
  const items: ItemCardData[] = Object.entries(store).map(([key, r]) => ({
    id: key,
    category: "boardgame",
    title: r.name,
    year: r.year,
    cover_url: r.cover_url,
    rating: r.rating,
  }));
  return items.sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title),
  );
}

export function getPreviewBoardgame(id: string): BoardgameDetail | null {
  const store = loadBoardgameStore();
  const r = store[id];
  if (!r) return null;
  return buildBoardgameDetail(id, r);
}

// --- Video games -----------------------------------------------------------

let cachedVgRows: GrouveeRow[] | null = null;

export type VideogameDetail = {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  cover_url: string | null;
  status: string | null;
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
  franchises: string[];
  release_date: string | null;
  igdb_id: string | null;
  grouvee_url: string | null;
};

function findGrouveeCsv(): string | null {
  const dir = resolve(process.cwd(), "data");
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir)
    .filter((f) => f.includes("grouvee") && f.endsWith(".csv"))
    .sort()
    .pop();
  return file ? resolve(dir, file) : null;
}

function loadVideogameRows(): GrouveeRow[] {
  if (cachedVgRows) return cachedVgRows;
  const path = findGrouveeCsv();
  if (!path) {
    cachedVgRows = [];
    return cachedVgRows;
  }
  cachedVgRows = safeParseCsv<GrouveeRow>(path).filter((r) => r.id && r.name);
  return cachedVgRows;
}

function buildVideogameDetail(r: GrouveeRow, covers: Record<string, string>): VideogameDetail {
  const id = `grouvee-${r.id}`;
  return {
    id,
    title: r.name,
    year: parseYear(r.release_date),
    rating: grouveeRatingToTen(r.rating),
    cover_url: covers[id] ?? null,
    status: statusFromShelves(r.shelves),
    platforms: namesFromJsonMap(r.platforms),
    genres: namesFromJsonMap(r.genres),
    developers: namesFromJsonMap(r.developers),
    publishers: namesFromJsonMap(r.publishers),
    franchises: namesFromJsonMap(r.franchises),
    release_date: r.release_date || null,
    igdb_id: r.igdb_id || null,
    grouvee_url: r.url || null,
  };
}

export function getPreviewVideogames(): ItemCardData[] {
  const rows = loadVideogameRows();
  const covers = loadCovers();
  const items: ItemCardData[] = rows.map((r) => {
    const id = `grouvee-${r.id}`;
    return {
      id,
      category: "videogame",
      title: r.name,
      year: parseYear(r.release_date),
      cover_url: covers[id] ?? null,
      rating: grouveeRatingToTen(r.rating),
    };
  });
  return items.sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title),
  );
}

export function getPreviewVideogame(id: string): VideogameDetail | null {
  const rows = loadVideogameRows();
  const covers = loadCovers();
  const row = rows.find((r) => `grouvee-${r.id}` === id);
  if (!row) return null;
  return buildVideogameDetail(row, covers);
}

// --- Combined / home-page helpers -----------------------------------------

export function getPreviewStats() {
  const bg = getPreviewBoardgames();
  const vg = getPreviewVideogames();
  const bgRated = bg.map((i) => i.rating).filter((r): r is number => r !== null);
  const vgRated = vg.map((i) => i.rating).filter((r): r is number => r !== null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const topRated = [...bg, ...vg]
    .filter((i) => i.rating !== null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6);
  // No created_at in CSVs — show a slice of the head as "recent"
  const recent = [...bg, ...vg].slice(0, 6);
  return {
    bgCount: bg.length,
    vgCount: vg.length,
    bgAvg: avg(bgRated),
    vgAvg: avg(vgRated),
    topRated,
    recent,
  };
}
