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
  type HomePlayRow,
  type VideogameDetail,
} from "./preview";
import { createClient } from "./supabase/server";
import type { LudopediaPartida } from "./apis/ludopedia";
import { ENABLED_CATEGORIES, type CategoryEnum } from "./categories";
import type { ItemCardData } from "@/components/ItemCard";

export type { HomePlayRow };

// ---------- types ----------

/** Per-category aggregates rendered on the landing page. */
export type CategoryStats = {
  count: number;
  avg: number | null;
  /** Top 6 by rating (descending). */
  top: ItemCardData[];
  /** Secondary "highlight" list: meaning depends on the category — most-played
   *  for boardgames, recently-added for videogames. See `CategoryConfig.highlight`. */
  highlight: ItemCardData[];
};

export type HomeStats = {
  /** Keyed by category enum; only includes categories the home page renders. */
  byCategory: Partial<Record<CategoryEnum, CategoryStats>>;
  recentPlays: HomePlayRow[];
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

/**
 * Generic list query for any category. Pages should call this rather than the
 * legacy `getBoardgames()` / `getVideogames()` wrappers below.
 */
export async function getItemsByCategory(
  category: CategoryEnum,
): Promise<ItemCardData[]> {
  if (isPreviewMode()) {
    if (category === "boardgame") return getPreviewBoardgames();
    if (category === "videogame") return getPreviewVideogames();
    return []; // movies/series/restaurants — no preview data yet
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select(ITEM_LIST_FIELDS)
    .eq("category", category)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("title")
    .returns<ItemRow[]>();
  return (data ?? []).map(itemRowToCard);
}

// Thin per-category wrappers — kept for the homepage stats helper that needs
// both lists at once. New code should prefer getItemsByCategory().
export const getBoardgames = () => getItemsByCategory("boardgame");
export const getVideogames = () => getItemsByCategory("videogame");

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

type RecentPlayRow = {
  id: string;
  played_on: string;
  duration_min: number | null;
  play_participants: Array<{ ludopedia_user_id: number | null; winner: boolean }>;
  items: {
    id: string;
    title: string;
    cover_url: string | null;
    item_externals: Array<{ source: string; external_id: string }>;
  };
};

const OWNER_LUDOPEDIA_USER_ID = 115441;

function recentPlayRowToHome(row: RecentPlayRow): HomePlayRow {
  const me = row.play_participants.find(
    (p) => p.ludopedia_user_id === OWNER_LUDOPEDIA_USER_ID,
  );
  // Build slug from the item's externals (ludopedia for boardgames).
  const ext = row.items.item_externals.find((e) => e.source === "ludopedia");
  const slug = ext ? `ludo-${ext.external_id}` : `id-${row.items.id}`;
  return {
    play_id: row.id,
    played_on: row.played_on,
    duration_min: row.duration_min,
    won: me?.winner === true,
    item_slug: slug,
    item_title: row.items.title,
    item_cover_url: row.items.cover_url,
  };
}

async function fetchCategoryStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  category: CategoryEnum,
): Promise<CategoryStats> {
  const config = ENABLED_CATEGORIES.find((c) => c.enum === category);
  // For "mostPlayed" highlight: order by play_count desc + filter > 0 so games
  // never played don't dilute the list.
  const highlightQuery =
    config?.highlight === "mostPlayed"
      ? supabase
          .from("items")
          .select(ITEM_LIST_FIELDS)
          .eq("category", category)
          .gt("play_count", 0)
          .order("play_count", { ascending: false })
          .limit(6)
      : supabase
          .from("items")
          .select(ITEM_LIST_FIELDS)
          .eq("category", category)
          .order("created_at", { ascending: false })
          .limit(6);

  const [countQ, avgQ, topQ, highlightQ] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("category", category),
    supabase
      .from("items")
      .select("rating")
      .eq("category", category)
      .not("rating", "is", null)
      .returns<Array<{ rating: number | null }>>(),
    supabase
      .from("items")
      .select(ITEM_LIST_FIELDS)
      .eq("category", category)
      .not("rating", "is", null)
      .order("rating", { ascending: false })
      .limit(6)
      .returns<ItemRow[]>(),
    highlightQuery.returns<ItemRow[]>(),
  ]);
  const nums = (avgQ.data ?? [])
    .map((r) => Number(r.rating))
    .filter((n) => Number.isFinite(n));
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  return {
    count: countQ.count ?? 0,
    avg,
    top: (topQ.data ?? []).map(itemRowToCard),
    highlight: (highlightQ.data ?? []).map(itemRowToCard),
  };
}

export async function getHomeStats(): Promise<HomeStats> {
  if (isPreviewMode()) return getPreviewStats();
  const supabase = await createClient();

  const [enabledStats, recentPlaysQ] = await Promise.all([
    Promise.all(
      ENABLED_CATEGORIES.map(async (c) => [c.enum, await fetchCategoryStats(supabase, c.enum)] as const),
    ),
    supabase
      .from("plays")
      .select(
        "id, played_on, duration_min, play_participants(ludopedia_user_id, winner), items!inner(id, title, cover_url, item_externals(source, external_id))",
      )
      .order("played_on", { ascending: false })
      .limit(6)
      .returns<RecentPlayRow[]>(),
  ]);

  const byCategory: Partial<Record<CategoryEnum, CategoryStats>> = {};
  for (const [cat, stats] of enabledStats) byCategory[cat] = stats;

  return {
    byCategory,
    recentPlays: (recentPlaysQ.data ?? []).map(recentPlayRowToHome),
  };
}
