/**
 * Preview mode: read the CSVs in data/ directly at request time.
 * Activated with PREVIEW_MODE=1. Lets you see the UI populated with your real
 * collection before wiring up Supabase.
 *
 * Covers aren't in the CSVs — tiles show a gray placeholder until you run the
 * real import (which enriches via BGG/IGDB APIs).
 */
import "server-only";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { bggRatingToTen, grouveeRatingToTen } from "./ratings";
import type { ItemCardData } from "@/components/ItemCard";

// Covers produced by `npm run enrich:preview`, keyed by preview item id (e.g. "bgg-224517").
// Read fresh each call — the JSON gets rewritten by the enrichment script while the dev
// server is running, and stale in-memory caches turned out to mask new covers.
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

type BggRow = {
  objectname: string;
  objectid: string;
  rating: string;
  yearpublished: string;
  originalname: string;
  numplays: string;
  minplayers: string;
  maxplayers: string;
  playingtime: string;
  weight: string;      // user's personal weight (often 0)
  avgweight: string;   // BGG's crowdsourced weight — prefer this for display
  rank: string;
  own: string;
};

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

// CSV parsing is the expensive part — cache the raw rows, but rebuild the
// ItemCardData objects every call so they pick up freshly-written covers.
let cachedBgRows: BggRow[] | null = null;

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
  weight: number | null;
  bgg_rank: number | null;
  mechanics: string[];
  categories: string[];
  bgg_id: string;
};

function loadBoardgameRows(): BggRow[] {
  if (cachedBgRows) return cachedBgRows;
  const path = resolve(process.cwd(), "data/collection.csv");
  cachedBgRows = safeParseCsv<BggRow>(path).filter(
    (r) => r.objectid && r.objectname,
  );
  return cachedBgRows;
}

function buildBoardgameDetail(r: BggRow, covers: Record<string, string>): BoardgameDetail {
  const id = `bgg-${r.objectid}`;
  const rating = bggRatingToTen(r.rating);
  const year = parseYear(r.yearpublished);
  const cover_url = covers[id] ?? null;
  return {
    id,
    title: r.objectname,
    year,
    rating,
    cover_url,
    play_count: Number(r.numplays) || 0,
    status: r.own === "1" ? "owned" : null,
    notes: null,
    min_players: parseIntMaybe(r.minplayers),
    max_players: parseIntMaybe(r.maxplayers),
    playing_time_min: parseIntMaybe(r.playingtime),
    weight: parseFloatMaybe(r.avgweight) ?? parseFloatMaybe(r.weight),
    bgg_rank: parseIntMaybe(r.rank),
    mechanics: [],
    categories: [],
    bgg_id: r.objectid,
  };
}

export function getPreviewBoardgames(): ItemCardData[] {
  const rows = loadBoardgameRows();
  const covers = loadCovers();
  const items: ItemCardData[] = rows.map((r) => {
    const id = `bgg-${r.objectid}`;
    return {
      id,
      category: "boardgame",
      title: r.objectname,
      year: parseYear(r.yearpublished),
      cover_url: covers[id] ?? null,
      rating: bggRatingToTen(r.rating),
    };
  });
  return items.sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title),
  );
}

export function getPreviewBoardgame(id: string): BoardgameDetail | null {
  const rows = loadBoardgameRows();
  const covers = loadCovers();
  const row = rows.find((r) => `bgg-${r.objectid}` === id);
  if (!row) return null;
  return buildBoardgameDetail(row, covers);
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
