/**
 * Unified data layer. Pages always import from here — internally we either
 * read local JSON caches (PREVIEW_MODE=1) or query Supabase.
 *
 * URL slugs are stable across both backends:
 *   board games  → "ludo-<id_jogo>"            (ludopedia)
 *   video games  → "igdb-<igdb_id>"            (preferred when present)
 *                  "grouvee-<grouvee_id>"      (fallback)
 */
import "server-only";
import {
  getPreviewBoardgame,
  getPreviewBoardgames,
  getPreviewStats,
  getPreviewVideogame,
  getPreviewVideogames,
  isPreviewMode,
  type BoardgameDetail,
  type VideogameDetail,
} from "./preview";
import { createClient } from "./supabase/server";
import type { LudopediaPartida } from "./apis/ludopedia";
import type { ItemCardData } from "@/components/ItemCard";

// ---------- types ----------

export type HomeStats = {
  bgCount: number;
  vgCount: number;
  bgAvg: number | null;
  vgAvg: number | null;
  topRated: ItemCardData[];
  recent: ItemCardData[];
};

type ExternalRow = { source: string; external_id: string; url: string | null };

type ItemRow = {
  id: string;
  category: "boardgame" | "videogame" | "movie" | "series" | "restaurant";
  title: string;
  year: number | null;
  cover_url: string | null;
  rating: number | null;
  play_count: number;
  status: string | null;
  comment: string | null;
  min_players: number | null;
  max_players: number | null;
  playing_time_min: number | null;
  age_min: number | null;
  designers: string[];
  artists: string[];
  themes: string[];
  mechanics: string[];
  platforms: string[];
  genres: string[];
  developers: string[];
  publishers: string[];
  franchises: string[];
  release_date: string | null;
  cost: number | null;
  created_at: string;
  item_externals?: ExternalRow[];
};

type PlayRow = {
  id: string;
  external_id: string | null;
  played_on: string;
  duration_min: number | null;
  description: string | null;
  bundled_count: number;
  play_participants: Array<{
    id: string;
    name: string;
    ludopedia_user_id: number | null;
    score: number | null;
    winner: boolean;
    observation: string | null;
  }>;
};

// ---------- slug helpers ----------

/**
 * URL slug for a card. Picks the most specific external id available.
 * Stable: same item → same slug across runs and across preview/live modes.
 */
function slugForItem(item: ItemRow): string {
  const externals = item.item_externals ?? [];
  const find = (s: string) => externals.find((e) => e.source === s);
  if (item.category === "boardgame") {
    const ludo = find("ludopedia");
    if (ludo) return `ludo-${ludo.external_id}`;
  }
  if (item.category === "videogame") {
    const igdb = find("igdb");
    if (igdb) return `igdb-${igdb.external_id}`;
    const grouvee = find("grouvee");
    if (grouvee) return `grouvee-${grouvee.external_id}`;
  }
  // generic fallback — should never hit for current data
  return `id-${item.id}`;
}

const SLUG_PREFIX_TO_SOURCE: Record<string, string> = {
  ludo: "ludopedia",
  igdb: "igdb",
  grouvee: "grouvee",
  bgg: "bgg",
};

function parseSlug(slug: string): { source: string; externalId: string } | null {
  const m = slug.match(/^([a-z]+)-(.+)$/);
  if (!m) return null;
  const source = SLUG_PREFIX_TO_SOURCE[m[1]];
  if (!source) return null;
  return { source, externalId: m[2] };
}

/** Find an item's UUID by slug. Returns null if no match. */
async function lookupItemId(slug: string): Promise<string | null> {
  const parsed = parseSlug(slug);
  if (!parsed) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("item_externals")
    .select("item_id")
    .eq("source", parsed.source)
    .eq("external_id", parsed.externalId)
    .maybeSingle<{ item_id: string }>();
  return data?.item_id ?? null;
}

// ---------- card-shape mapping ----------

function itemRowToCard(row: ItemRow): ItemCardData {
  return {
    id: slugForItem(row),
    category: row.category,
    title: row.title,
    year: row.year,
    cover_url: row.cover_url,
    rating: row.rating === null ? null : Number(row.rating),
  };
}

function playRowToLudopedia(row: PlayRow): LudopediaPartida {
  return {
    id_partida: Number(row.external_id ?? row.id),
    dt_partida: row.played_on,
    duracao: row.duration_min,
    qt_partidas: row.bundled_count,
    descricao: row.description ?? undefined,
    jogadores: row.play_participants.map((p) => ({
      nome: p.name,
      id_usuario: p.ludopedia_user_id,
      id_partida_jogador: undefined,
      fl_vencedor: p.winner ? 1 : 0,
      vl_pontos: p.score,
      observacao: p.observation ?? undefined,
    })),
    expansoes: [],
  };
}

function itemRowToBoardgameDetail(row: ItemRow, plays: PlayRow[]): BoardgameDetail {
  const ludo = (row.item_externals ?? []).find((e) => e.source === "ludopedia");
  return {
    id: slugForItem(row),
    title: row.title,
    year: row.year,
    rating: row.rating === null ? null : Number(row.rating),
    cover_url: row.cover_url,
    play_count: row.play_count,
    status: row.status,
    notes: null,
    min_players: row.min_players,
    max_players: row.max_players,
    playing_time_min: row.playing_time_min,
    age_min: row.age_min,
    mechanics: row.mechanics,
    designers: row.designers,
    artists: row.artists,
    themes: row.themes,
    ludopedia_id: ludo ? Number(ludo.external_id) : null,
    ludopedia_url: ludo?.url ?? null,
    cost: row.cost === null ? null : Number(row.cost),
    comment: row.comment,
    plays: plays.map(playRowToLudopedia),
  };
}

function itemRowToVideogameDetail(row: ItemRow): VideogameDetail {
  const externals = row.item_externals ?? [];
  const igdb = externals.find((e) => e.source === "igdb");
  const grouvee = externals.find((e) => e.source === "grouvee");
  return {
    id: slugForItem(row),
    title: row.title,
    year: row.year,
    rating: row.rating === null ? null : Number(row.rating),
    cover_url: row.cover_url,
    status: row.status,
    platforms: row.platforms,
    genres: row.genres,
    developers: row.developers,
    publishers: row.publishers,
    franchises: row.franchises,
    release_date: row.release_date,
    igdb_id: igdb?.external_id ?? null,
    grouvee_url: grouvee?.url ?? null,
  };
}

// ---------- public API ----------

const ITEM_LIST_FIELDS =
  "id, category, title, year, cover_url, rating, item_externals(source, external_id, url)";

const ITEM_FULL_FIELDS = `
  id, category, title, year, cover_url, rating, play_count, status, comment,
  min_players, max_players, playing_time_min, age_min,
  designers, artists, themes, mechanics,
  platforms, genres, developers, publishers, franchises, release_date,
  cost, created_at,
  item_externals(source, external_id, url)
`;

export async function getBoardgames(): Promise<ItemCardData[]> {
  if (isPreviewMode()) return getPreviewBoardgames();
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(ITEM_LIST_FIELDS)
    .eq("category", "boardgame")
    .order("rating", { ascending: false, nullsFirst: false })
    .order("title")
    .returns<ItemRow[]>();
  return (data ?? []).map(itemRowToCard);
}

export async function getVideogames(): Promise<ItemCardData[]> {
  if (isPreviewMode()) return getPreviewVideogames();
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(ITEM_LIST_FIELDS)
    .eq("category", "videogame")
    .order("rating", { ascending: false, nullsFirst: false })
    .order("title")
    .returns<ItemRow[]>();
  return (data ?? []).map(itemRowToCard);
}

export async function getBoardgame(slug: string): Promise<BoardgameDetail | null> {
  if (isPreviewMode()) return getPreviewBoardgame(slug);
  const itemId = await lookupItemId(slug);
  if (!itemId) return null;
  const supabase = await createClient();
  const [{ data: item }, { data: plays }] = await Promise.all([
    supabase
      .from("items")
      .select(ITEM_FULL_FIELDS)
      .eq("id", itemId)
      .maybeSingle<ItemRow>(),
    supabase
      .from("plays")
      .select(
        "id, external_id, played_on, duration_min, description, bundled_count, play_participants(id, name, ludopedia_user_id, score, winner, observation)",
      )
      .eq("item_id", itemId)
      .order("played_on", { ascending: false })
      .returns<PlayRow[]>(),
  ]);
  if (!item) return null;
  return itemRowToBoardgameDetail(item, plays ?? []);
}

export async function getVideogame(slug: string): Promise<VideogameDetail | null> {
  if (isPreviewMode()) return getPreviewVideogame(slug);
  const itemId = await lookupItemId(slug);
  if (!itemId) return null;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("items")
    .select(ITEM_FULL_FIELDS)
    .eq("id", itemId)
    .maybeSingle<ItemRow>();
  if (!item) return null;
  return itemRowToVideogameDetail(item);
}

/** Returns just the title + cover + year (used by the [id]/layout.tsx). */
export async function getBoardgameCover(
  slug: string,
): Promise<{ title: string; cover_url: string | null; year: number | null } | null> {
  if (isPreviewMode()) {
    const d = getPreviewBoardgame(slug);
    if (!d) return null;
    return { title: d.title, cover_url: d.cover_url, year: d.year };
  }
  const itemId = await lookupItemId(slug);
  if (!itemId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("title, cover_url, year")
    .eq("id", itemId)
    .maybeSingle<{ title: string; cover_url: string | null; year: number | null }>();
  return data ?? null;
}

export async function getHomeStats(): Promise<HomeStats> {
  if (isPreviewMode()) return getPreviewStats();
  const supabase = await createClient();
  const [bgCount, vgCount, bgAvgQ, vgAvgQ, topRated, recent] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("category", "boardgame"),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("category", "videogame"),
    supabase
      .from("items")
      .select("rating")
      .eq("category", "boardgame")
      .not("rating", "is", null)
      .returns<Array<{ rating: number | null }>>(),
    supabase
      .from("items")
      .select("rating")
      .eq("category", "videogame")
      .not("rating", "is", null)
      .returns<Array<{ rating: number | null }>>(),
    supabase
      .from("items")
      .select(ITEM_LIST_FIELDS)
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .limit(6)
      .returns<ItemRow[]>(),
    supabase
      .from("items")
      .select(ITEM_LIST_FIELDS)
      .order("created_at", { ascending: false })
      .limit(6)
      .returns<ItemRow[]>(),
  ]);
  const avg = (rows: Array<{ rating: number | null }> | null) => {
    if (!rows || rows.length === 0) return null;
    const nums = rows.map((r) => Number(r.rating)).filter((n) => Number.isFinite(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };
  return {
    bgCount: bgCount.count ?? 0,
    vgCount: vgCount.count ?? 0,
    bgAvg: avg(bgAvgQ.data),
    vgAvg: avg(vgAvgQ.data),
    topRated: (topRated.data ?? []).map(itemRowToCard),
    recent: (recent.data ?? []).map(itemRowToCard),
  };
}
