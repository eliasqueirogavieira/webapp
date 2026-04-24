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
  weight: string;
  rank: string;
  own: string;
};

type GrouveeRow = {
  id: string;
  name: string;
  rating: string;
  release_date: string;
  igdb_id: string;
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

let cachedBgItems: ItemCardData[] | null = null;
let cachedBgDetails: Map<string, BoardgameDetail> | null = null;

export type BoardgameDetail = {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  cover_url: null;
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

function loadBoardgames() {
  if (cachedBgItems && cachedBgDetails) return;
  const path = resolve(process.cwd(), "data/collection.csv");
  const rows = safeParseCsv<BggRow>(path).filter((r) => r.objectid && r.objectname);
  const items: ItemCardData[] = [];
  const details = new Map<string, BoardgameDetail>();
  for (const r of rows) {
    const id = `bgg:${r.objectid}`;
    const rating = bggRatingToTen(r.rating);
    const year = parseYear(r.yearpublished);
    items.push({
      id,
      category: "boardgame",
      title: r.objectname,
      year,
      cover_url: null,
      rating,
    });
    details.set(id, {
      id,
      title: r.objectname,
      year,
      rating,
      cover_url: null,
      play_count: Number(r.numplays) || 0,
      status: r.own === "1" ? "owned" : null,
      notes: null,
      min_players: parseIntMaybe(r.minplayers),
      max_players: parseIntMaybe(r.maxplayers),
      playing_time_min: parseIntMaybe(r.playingtime),
      weight: parseFloatMaybe(r.weight),
      bgg_rank: parseIntMaybe(r.rank),
      mechanics: [],
      categories: [],
      bgg_id: r.objectid,
    });
  }
  cachedBgItems = items;
  cachedBgDetails = details;
}

export function getPreviewBoardgames(): ItemCardData[] {
  loadBoardgames();
  return [...cachedBgItems!].sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title),
  );
}

export function getPreviewBoardgame(id: string): BoardgameDetail | null {
  loadBoardgames();
  return cachedBgDetails!.get(id) ?? null;
}

// --- Video games -----------------------------------------------------------

let cachedVgItems: ItemCardData[] | null = null;
let cachedVgDetails: Map<string, VideogameDetail> | null = null;

export type VideogameDetail = {
  id: string;
  title: string;
  year: number | null;
  rating: number | null;
  cover_url: null;
  status: string | null;
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
  franchises: string[];
  release_date: string | null;
  igdb_id: string | null;
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

function loadVideogames() {
  if (cachedVgItems && cachedVgDetails) return;
  const path = findGrouveeCsv();
  if (!path) {
    cachedVgItems = [];
    cachedVgDetails = new Map();
    return;
  }
  const rows = safeParseCsv<GrouveeRow>(path).filter((r) => r.id && r.name);
  const items: ItemCardData[] = [];
  const details = new Map<string, VideogameDetail>();
  for (const r of rows) {
    const id = `grouvee:${r.id}`;
    const rating = grouveeRatingToTen(r.rating);
    const year = parseYear(r.release_date);
    items.push({
      id,
      category: "videogame",
      title: r.name,
      year,
      cover_url: null,
      rating,
    });
    details.set(id, {
      id,
      title: r.name,
      year,
      rating,
      cover_url: null,
      status: statusFromShelves(r.shelves),
      platforms: namesFromJsonMap(r.platforms),
      genres: namesFromJsonMap(r.genres),
      developers: namesFromJsonMap(r.developers),
      publishers: namesFromJsonMap(r.publishers),
      franchises: namesFromJsonMap(r.franchises),
      release_date: r.release_date || null,
      igdb_id: r.igdb_id || null,
    });
  }
  cachedVgItems = items;
  cachedVgDetails = details;
}

export function getPreviewVideogames(): ItemCardData[] {
  loadVideogames();
  return [...cachedVgItems!].sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title),
  );
}

export function getPreviewVideogame(id: string): VideogameDetail | null {
  loadVideogames();
  return cachedVgDetails!.get(id) ?? null;
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
