/**
 * One-shot seed: pushes every board game (from Ludopedia cache) and every
 * video game (from Grouvee CSV + IGDB covers cache) into Supabase.
 *
 * Idempotent — safe to re-run. Uses (source, external_id) as the dedupe key
 * via item_externals, so a re-run updates rows in place rather than inserting
 * duplicates.
 *
 * Runs with the service-role key, bypassing RLS. Never invoked from the
 * browser or a server action; only from your laptop.
 *
 * Usage:
 *   npm run seed:supabase                # fills/updates everything
 *   npm run seed:supabase -- --reset     # truncates items first (DANGER, asks for confirmation)
 */
import "./_load-env";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { grouveeRatingToTen } from "../src/lib/ratings";
import type {
  BggCollectionRow,
  BggThing,
} from "../src/lib/apis/bgg";

// ---------- types ----------

type LudopediaPartida = {
  id_partida: number;
  dt_partida: string;
  duracao: number | null;
  qt_partidas: number;
  descricao?: string;
  jogadores: Array<{
    nome: string;
    id_usuario: number | null;
    fl_vencedor: 0 | 1;
    vl_pontos: number | null;
    observacao?: string;
  }>;
  expansoes?: Array<{ id_jogo: number; nm_jogo: string }>;
};

type BoardgameRecord = {
  id_jogo: number;
  name: string;
  original_name?: string | null;
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

type GrouveeRow = {
  id: string;
  name: string;
  rating: string;
  release_date: string;
  igdb_id: string;
  url: string;
  shelves: string;
  platforms: string;
  genres: string;
  developers: string;
  publishers: string;
  franchises: string;
  date_added_to_collection: string; // YYYY-MM-DD
};

// ---------- helpers ----------

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function namesFromJsonMap(raw: string | undefined): string[] {
  if (!raw || raw === "{}") return [];
  try {
    return Object.keys(JSON.parse(raw));
  } catch {
    return [];
  }
}

function statusFromShelves(raw: string | undefined): string[] | null {
  const keys = namesFromJsonMap(raw).map((k) => k.toLowerCase());
  const out: string[] = [];
  if (keys.includes("played")) out.push("played");
  if (keys.includes("playing") || keys.includes("backlog")) out.push("backlog");
  if (keys.includes("wishlist")) out.push("wishlist");
  if (keys.includes("abandoned")) out.push("abandoned");
  return out.length ? out : null;
}

function statusFromBoardgame(b: BoardgameRecord): string[] | null {
  const out: string[] = [];
  if (b.owned) out.push("owned");
  if (b.played) out.push("played");
  if (b.wishlist) out.push("wishlist");
  if (b.favorite) out.push("favorite");
  return out.length ? out : null;
}

function parseYear(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).slice(0, 4));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

// ---------- seed: board games ----------

async function seedBoardgames(supabase: ReturnType<typeof admin>) {
  const path = resolve(process.cwd(), "data/preview-boardgames.json");
  if (!existsSync(path)) {
    console.log("No data/preview-boardgames.json — skipping board games.");
    return;
  }
  const store: Record<string, BoardgameRecord> = JSON.parse(
    readFileSync(path, "utf-8"),
  );
  const games = Object.values(store);
  console.log(`Board games: ${games.length} entries.`);

  let i = 0;
  for (const b of games) {
    i++;
    // 1) upsert item; key by (source='ludopedia', external_id=id_jogo)
    const itemId = await upsertItem(supabase, {
      category: "boardgame",
      title: b.name,
      original_title: b.original_name ?? null,
      year: b.year,
      cover_url: b.cover_url,
      rating: b.rating,
      play_count: b.play_count,
      status: statusFromBoardgame(b),
      comment: b.comment,
      min_players: b.min_players,
      max_players: b.max_players,
      playing_time_min: b.playing_time_min,
      age_min: b.age_min,
      designers: b.designers,
      artists: b.artists,
      themes: b.themes,
      mechanics: b.mechanics,
      cost: b.cost,
      external_id: String(b.id_jogo),
      external_source: "ludopedia",
      external_url: b.ludopedia_url,
    });
    // 2) plays — upsert by (source, external_id). Same id_partida can come
    //    back from multiple /partidas queries (e.g. base game + its expansion);
    //    we let the latest game-context "win" attribution.
    if (b.plays.length > 0) {
      const playRows = b.plays.map((p) => ({
        item_id: itemId,
        source: "ludopedia" as const,
        external_id: String(p.id_partida),
        played_on: p.dt_partida,
        duration_min: p.duracao,
        description: p.descricao || null,
        bundled_count: p.qt_partidas || 1,
      }));
      const { data: inserted, error } = await supabase
        .from("plays")
        .upsert(playRows, { onConflict: "source,external_id" })
        .select("id, external_id");
      if (error) throw error;
      const playIdByExternal = new Map(
        (inserted ?? []).map((r: { id: string; external_id: string }) => [
          r.external_id,
          r.id,
        ]),
      );
      // 3) participants — wipe each play's existing participants, then insert.
      //    Upsert on plays preserves the row's `id`, so existing participant
      //    rows would otherwise stack on every re-run.
      const playIds = Array.from(playIdByExternal.values());
      if (playIds.length > 0) {
        await supabase.from("play_participants").delete().in("play_id", playIds);
      }
      const participantRows: Array<{
        play_id: string;
        name: string;
        ludopedia_user_id: number | null;
        score: number | null;
        winner: boolean;
        observation: string | null;
      }> = [];
      for (const p of b.plays) {
        const playId = playIdByExternal.get(String(p.id_partida));
        if (!playId) continue;
        for (const j of p.jogadores) {
          participantRows.push({
            play_id: playId,
            name: j.nome,
            ludopedia_user_id: j.id_usuario,
            score: j.vl_pontos,
            winner: j.fl_vencedor === 1,
            observation: j.observacao || null,
          });
        }
      }
      if (participantRows.length > 0) {
        const { error: pErr } = await supabase
          .from("play_participants")
          .insert(participantRows);
        if (pErr) throw pErr;
      }
    }
    process.stdout.write(`  ${i}/${games.length} ${b.name.slice(0, 50)}\r\x1b[K`);
  }
  console.log(`\nBoard games done.`);
}

// ---------- seed: video games ----------

async function seedVideogames(supabase: ReturnType<typeof admin>) {
  const dataDir = resolve(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    console.log("No data/ — skipping video games.");
    return;
  }
  const file = readdirSync(dataDir)
    .filter((f) => f.includes("grouvee") && f.endsWith(".csv"))
    .sort()
    .pop();
  if (!file) {
    console.log("No grouvee CSV — skipping video games.");
    return;
  }
  const csv = readFileSync(resolve(dataDir, file), "utf-8");
  const { data: rows } = Papa.parse<GrouveeRow>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  // covers
  const coversPath = resolve(dataDir, "preview-covers.json");
  const covers: Record<string, string> = existsSync(coversPath)
    ? JSON.parse(readFileSync(coversPath, "utf-8"))
    : {};

  console.log(`Video games: ${rows.length} entries.`);

  let i = 0;
  for (const r of rows) {
    if (!r.id || !r.name) continue;
    i++;
    const cover = covers[`grouvee-${r.id}`] ?? null;
    const status = statusFromShelves(r.shelves);
    const platforms = namesFromJsonMap(r.platforms);
    const genres = namesFromJsonMap(r.genres);
    const developers = namesFromJsonMap(r.developers);
    const publishers = namesFromJsonMap(r.publishers);
    const franchises = namesFromJsonMap(r.franchises);
    const year = parseYear(r.release_date);

    // primary external = igdb when present, else grouvee
    const primarySource = r.igdb_id ? "igdb" : "grouvee";
    const primaryId = r.igdb_id || r.id;

    // Grouvee export gives an explicit date-added per row (YYYY-MM-DD).
    // Use it as created_at so "Adicionados recentemente" reflects real order.
    const createdAt = r.date_added_to_collection
      ? new Date(`${r.date_added_to_collection}T12:00:00Z`).toISOString()
      : null;

    const itemId = await upsertItem(supabase, {
      category: "videogame",
      title: r.name,
      year,
      cover_url: cover,
      rating: grouveeRatingToTen(r.rating),
      play_count: 0,
      status,
      comment: null,
      min_players: null,
      max_players: null,
      playing_time_min: null,
      age_min: null,
      designers: [],
      artists: [],
      themes: [],
      mechanics: [],
      platforms,
      genres,
      developers,
      publishers,
      franchises,
      release_date: r.release_date || null,
      cost: null,
      created_at: createdAt,
      external_id: primaryId,
      external_source: primarySource,
      external_url:
        primarySource === "igdb"
          ? `https://www.igdb.com/search?q=${encodeURIComponent(r.name)}`
          : r.url || null,
    });

    // also store the secondary external (grouvee) when igdb was primary
    if (r.igdb_id && r.id) {
      await supabase.from("item_externals").upsert(
        {
          item_id: itemId,
          source: "grouvee",
          external_id: r.id,
          url: r.url || null,
        },
        { onConflict: "item_id,source" },
      );
    }

    process.stdout.write(`  ${i}/${rows.length} ${r.name.slice(0, 50)}\r\x1b[K`);
  }
  console.log(`\nVideo games done.`);
}

// ---------- shared upsert ----------

type ItemPayload = {
  category: "boardgame" | "videogame" | "movie" | "series" | "restaurant";
  title: string;
  /** English / canonical title — Ludopedia's nm_original. Used by the BGG
   *  matcher to bridge cross-language pairs. */
  original_title?: string | null;
  year: number | null;
  cover_url: string | null;
  rating: number | null;
  play_count: number;
  status: string[] | null;
  comment: string | null;
  min_players: number | null;
  max_players: number | null;
  playing_time_min: number | null;
  age_min: number | null;
  designers: string[];
  artists: string[];
  themes: string[];
  mechanics: string[];
  platforms?: string[];
  genres?: string[];
  developers?: string[];
  publishers?: string[];
  franchises?: string[];
  release_date?: string | null;
  cost: number | null;
  /** ISO timestamp; when set, drives the "added to collection" ordering. */
  created_at?: string | null;
  external_id: string;
  external_source: string;
  external_url: string | null;
};


// ---------- seed: BGG enrichment + wishlist ----------

type BggCachedRow = {
  collection: BggCollectionRow;
  thing: BggThing | null;
  fetched_at: string;
};

const BGG_URL = (id: string) => `https://boardgamegeek.com/boardgame/${id}`;

/** Manual BGG objectid → Ludopedia id_jogo overrides for cases where the
 *  matcher correctly recognizes distinct BGG products but the user owns
 *  only one and treats them as a single row (e.g. user has Decrypto: 5th
 *  Anniversary Edition on Ludopedia, mapped to base "Decrypto" on BGG). */
function loadBggAliases(): Map<string, string> {
  const path = resolve(process.cwd(), "data/bgg-aliases.json");
  if (!existsSync(path)) return new Map();
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(raw)) {
      if (k.startsWith("_")) continue; // skip _comment etc.
      if (typeof v === "number" || typeof v === "string") out.set(k, String(v));
    }
    return out;
  } catch {
    return new Map();
  }
}

const STOPWORDS = new Set(["and", "the", "of", "a", "an", "&"]);

/** Strip diacritics + ª/º + lowercase before tokenizing so "Edição" and
 *  "Edicao" produce the same token set. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .replace(/[ªº]/g, "") // ª º (ordinal indicators)
    .toLowerCase();
}

const tokens = (s: string) =>
  new Set(
    normalize(s)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  );

function tokenSetEqual(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (!tb.has(t)) return false;
  for (const t of tb) if (!ta.has(t)) return false;
  return true;
}

/** Looser fallback: Jaccard ≥ 0.6 on token sets. Year must match exactly
 *  for this to fire — keeps it tight enough that base + expansion of the
 *  same year (which usually share ≤ 50% tokens) don't get merged. */
function tokenSetJaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Map the BGG status flags onto our items.status array. own + wishlist
 *  can co-exist (e.g. you own the base game but want a deluxe edition).
 *  Wishlist and wanttobuy are coalesced per the user's preference.
 *  prevowned is tracked via was_owned only. */
function statusFromBggRow(c: BggCollectionRow): string[] | null {
  const out: string[] = [];
  if (c.status.own) out.push("owned");
  if (c.status.wishlist || c.status.wanttobuy || c.status.preordered)
    out.push("wishlist");
  return out.length ? out : null;
}

function bggLastModifiedToIso(s: string | null): string | null {
  // BGG: "YYYY-MM-DD HH:MM:SS" (UTC). Append "Z" for safety.
  if (!s) return null;
  const t = s.replace(" ", "T") + "Z";
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

type BoardgameItemRef = {
  id: string;
  title: string;
  original_title: string | null;
  year: number | null;
};

/** Try to find a single Ludopedia/existing item that matches a BGG row.
 *
 *  Tries the cross-product of BGG names (primary + alternates) against
 *  candidate names (title + original_title). `original_title` is critical
 *  for cross-language pairs — Ludopedia stores the English title there
 *  for translated entries, so it usually matches BGG's primary verbatim.
 *
 *  Matching tiers:
 *    1. Strict token-set equality, year ±1 (or unset on either side).
 *    2. Jaccard ≥ 0.6, year ±1 — kept tight enough that base + same-year
 *       expansion (which usually share ≤ 50% tokens) don't collapse.
 *
 *  Returns null on zero or multiple matches (defensive — never merge
 *  ambiguously). */
function matchBgg(
  cached: BggCachedRow,
  candidates: BoardgameItemRef[],
): BoardgameItemRef | null {
  const c = cached.collection;
  const bggNames = [c.name, ...(cached.thing?.alternateNames ?? [])].filter(Boolean);
  const yearOk = (a: number | null, b: number | null) => {
    if (a == null || b == null) return true;
    return Math.abs(a - b) <= 1; // ±1 — Tainted Grail is 2023 (Ludo) vs 2024 (BGG)
  };
  const candNames = (it: BoardgameItemRef) =>
    [it.title, it.original_title].filter((s): s is string => Boolean(s));

  // Strict pass.
  const strict = candidates.filter(
    (it) =>
      yearOk(it.year, c.yearpublished) &&
      bggNames.some((b) => candNames(it).some((cn) => tokenSetEqual(b, cn))),
  );
  if (strict.length === 1) return strict[0];
  if (strict.length > 1) return null;

  // Jaccard fallback — still year-gated.
  if (c.yearpublished == null) return null;
  const fuzzy = candidates.filter(
    (it) =>
      yearOk(it.year, c.yearpublished) &&
      bggNames.some((b) =>
        candNames(it).some((cn) => tokenSetJaccard(b, cn) >= 0.6),
      ),
  );
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

/** Pre-pass: existing rows where BGG-only items duplicate Ludopedia-only
 *  items. Move the BGG external + BGG-sourced columns to the Ludopedia row
 *  and delete the BGG-only row. Triggered when the matcher gains skill
 *  (alternate names, HTML decoding, diacritic stripping) and previously
 *  unmatched rows now have a home. Manual aliases in
 *  data/bgg-aliases.json win against any algorithmic match. */
async function dedupeBggOnlyItems(
  supabase: ReturnType<typeof admin>,
  store: Record<string, BggCachedRow>,
  aliases: Map<string, string>,
): Promise<number> {
  type Row = BoardgameItemRef & {
    sources: string[];
    bgg_external_id: string | null;
    ludo_external_id: string | null;
  };
  const { data } = await supabase
    .from("items")
    .select(
      "id, title, original_title, year, item_externals(source, external_id)",
    )
    .eq("category", "boardgame")
    .returns<
      Array<
        BoardgameItemRef & {
          item_externals: Array<{ source: string; external_id: string }>;
        }
      >
    >();
  const all: Row[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    original_title: r.original_title,
    year: r.year,
    sources: r.item_externals.map((e) => e.source),
    bgg_external_id:
      r.item_externals.find((e) => e.source === "bgg")?.external_id ?? null,
    ludo_external_id:
      r.item_externals.find((e) => e.source === "ludopedia")?.external_id ?? null,
  }));

  // BGG-only rows we might want to merge away.
  const bggOnly = all.filter(
    (r) => r.sources.includes("bgg") && !r.sources.includes("ludopedia"),
  );
  // Possible merge targets (have Ludopedia, not yet linked to BGG).
  const ludoOnly: Row[] = all.filter(
    (r) => r.sources.includes("ludopedia") && !r.sources.includes("bgg"),
  );
  if (bggOnly.length === 0 || ludoOnly.length === 0) return 0;

  // Quick lookup: ludopedia external_id → row.
  const byLudoId = new Map<string, Row>();
  for (const r of ludoOnly) {
    if (r.ludo_external_id) byLudoId.set(r.ludo_external_id, r);
  }

  let merged = 0;
  for (const dupe of bggOnly) {
    if (!dupe.bgg_external_id) continue;
    const cached = store[`bgg-${dupe.bgg_external_id}`];
    if (!cached) continue;
    // Manual alias wins over algorithmic matching.
    const aliasLudoId = aliases.get(dupe.bgg_external_id);
    const target = aliasLudoId
      ? byLudoId.get(aliasLudoId) ?? null
      : matchBgg(cached, ludoOnly);
    if (!target || target.id === dupe.id) continue;

    console.log(
      `  merge: BGG-only "${dupe.title}" (${dupe.year ?? "?"}) → ` +
        `"${target.title}" (${target.year ?? "?"})`,
    );

    // 1) Move the BGG external onto the Ludopedia row.
    await supabase
      .from("item_externals")
      .delete()
      .eq("item_id", dupe.id)
      .eq("source", "bgg");
    await supabase.from("item_externals").upsert(
      {
        item_id: target.id,
        source: "bgg",
        external_id: dupe.bgg_external_id,
        url: BGG_URL(dupe.bgg_external_id),
      },
      { onConflict: "item_id,source" },
    );
    // 2) Copy any BGG-only columns the dupe has but the target lacks.
    const { data: dupeRow } = await supabase
      .from("items")
      .select(
        "acquisition_date, wishlist_priority, weight, bgg_rank, was_owned, source_modified_at",
      )
      .eq("id", dupe.id)
      .maybeSingle<{
        acquisition_date: string | null;
        wishlist_priority: number | null;
        weight: number | null;
        bgg_rank: number | null;
        was_owned: boolean | null;
        source_modified_at: string | null;
      }>();
    if (dupeRow) {
      await supabase.from("items").update(dupeRow).eq("id", target.id);
    }
    // 3) Delete the duplicate row.
    await supabase.from("items").delete().eq("id", dupe.id);
    merged++;
    // Keep the in-memory ludoOnly list in sync (target is now bgg-linked).
    const idx = ludoOnly.findIndex((l) => l.id === target.id);
    if (idx >= 0) ludoOnly.splice(idx, 1);
  }
  return merged;
}

async function seedBgg(supabase: ReturnType<typeof admin>) {
  const path = resolve(process.cwd(), "data/preview-bgg.json");
  if (!existsSync(path)) {
    console.log("No data/preview-bgg.json — skipping BGG enrichment.");
    return;
  }
  const store: Record<string, BggCachedRow> = JSON.parse(
    readFileSync(path, "utf-8"),
  );
  const rows = Object.values(store);
  console.log(`BGG: ${rows.length} entries.`);

  const aliases = loadBggAliases();
  if (aliases.size > 0) {
    console.log(`  → ${aliases.size} manual alias(es) loaded from data/bgg-aliases.json`);
  }

  const dedupedCount = await dedupeBggOnlyItems(supabase, store, aliases);
  if (dedupedCount > 0) {
    console.log(`  → merged ${dedupedCount} BGG-only duplicates into Ludopedia rows.`);
  }

  // Pre-fetch all existing item titles once so we can match BGG-only rows
  // (e.g. wishlist games not in Ludopedia) against the existing collection.
  // Include the ludopedia external_id so manual aliases can target rows
  // directly, bypassing the algorithmic matcher.
  type ExistingItem = BoardgameItemRef & { ludo_external_id: string | null };
  const { data: existingItems } = await supabase
    .from("items")
    .select(
      "id, title, original_title, year, item_externals(source, external_id)",
    )
    .eq("category", "boardgame")
    .returns<
      Array<
        BoardgameItemRef & {
          item_externals: Array<{ source: string; external_id: string }>;
        }
      >
    >();
  const existing: ExistingItem[] = (existingItems ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    original_title: r.original_title,
    year: r.year,
    ludo_external_id:
      r.item_externals.find((e) => e.source === "ludopedia")?.external_id ?? null,
  }));
  const byLudoId = new Map<string, ExistingItem>();
  for (const it of existing) {
    if (it.ludo_external_id) byLudoId.set(it.ludo_external_id, it);
  }

  let matched = 0;
  let inserted = 0;
  let updatedAcq = 0;
  let i = 0;
  for (const cached of rows) {
    i++;
    const c = cached.collection;
    const t = cached.thing;

    // 1) try to find an existing item.
    let itemId: string | null = null;
    const { data: viaBgg } = await supabase
      .from("item_externals")
      .select("item_id")
      .eq("source", "bgg")
      .eq("external_id", c.id)
      .maybeSingle<{ item_id: string }>();
    if (viaBgg?.item_id) {
      itemId = viaBgg.item_id;
      matched++;
    } else {
      // Manual alias wins over the algorithmic matcher.
      const aliasLudoId = aliases.get(c.id);
      const aliasTarget = aliasLudoId ? byLudoId.get(aliasLudoId) ?? null : null;
      const target = aliasTarget ?? matchBgg(cached, existing);
      if (target) {
        itemId = target.id;
        matched++;
      }
    }

    const status = statusFromBggRow(c);
    const isBggOnlyInteresting =
      c.status.own || c.status.wishlist || c.status.wanttobuy || c.status.prevowned;

    if (!itemId) {
      // BGG-only row. Insert if owned / wishlist / want-to-buy / prev-owned
      // so the user's full BGG collection is represented. Other states
      // (e.g. for-trade alone) we skip to avoid noise.
      if (!isBggOnlyInteresting) continue;
      const { data: insertedRow, error } = await supabase
        .from("items")
        .insert({
          category: "boardgame",
          title: c.name,
          year: c.yearpublished,
          cover_url: c.image ?? c.thumbnail,
          rating: c.rating,
          play_count: c.numplays,
          status,
          comment: c.comment,
          min_players: t?.minPlayers ?? null,
          max_players: t?.maxPlayers ?? null,
          playing_time_min: t?.playingTimeMin ?? null,
          age_min: null,
          designers: t?.designers ?? [],
          artists: [],
          themes: [],
          mechanics: t?.mechanics ?? [],
        })
        .select("id")
        .single<{ id: string }>();
      if (error || !insertedRow) throw error ?? new Error("BGG insert failed");
      itemId = insertedRow.id;
      inserted++;
      // Keep our in-memory candidates in sync so subsequent rows can match.
      existing.push({
        id: itemId,
        title: c.name,
        original_title: null,
        year: c.yearpublished,
        ludo_external_id: null,
      });
    } else {
      // Existing item — refresh the title only when this is a BGG-only row
      // (no Ludopedia external). Catches stale HTML-encoded titles inserted
      // before decodeEntities was wired up. If a Ludopedia external exists,
      // its title is authoritative and we leave it untouched.
      const { data: srcs } = await supabase
        .from("item_externals")
        .select("source")
        .eq("item_id", itemId)
        .returns<Array<{ source: string }>>();
      const sources = (srcs ?? []).map((s) => s.source);
      if (sources.includes("bgg") && !sources.includes("ludopedia")) {
        await supabase
          .from("items")
          .update({
            title: c.name,
            year: c.yearpublished,
            cover_url: c.image ?? c.thumbnail,
          })
          .eq("id", itemId);
      }
    }

    // 2) write BGG external mapping (idempotent).
    await supabase.from("item_externals").upsert(
      {
        item_id: itemId,
        source: "bgg",
        external_id: c.id,
        url: BGG_URL(c.id),
      },
      { onConflict: "item_id,source" },
    );

    // 3) update BGG-sourced columns. NEVER overwrite Ludopedia-authored fields
    //    (title, cover_url, cost, rating, comment) — only fill ones BGG owns.
    const updates: Record<string, unknown> = {
      acquisition_date: c.privateinfo?.acquisitiondate ?? null,
      wishlist_priority: c.status.wishlist ? c.status.wishlistpriority : null,
      weight: t?.weight ?? null,
      bgg_rank: t?.bggRank ?? null,
      was_owned: c.status.prevowned,
      source_modified_at: bggLastModifiedToIso(c.status.lastmodified),
    };
    const { error: upErr } = await supabase
      .from("items")
      .update(updates)
      .eq("id", itemId);
    if (upErr) throw upErr;
    if (c.privateinfo?.acquisitiondate) updatedAcq++;

    process.stdout.write(`  ${i}/${rows.length} ${c.name.slice(0, 50)}\r\x1b[K`);
  }
  console.log(
    `\nBGG done. matched=${matched} inserted=${inserted} acquisition_dates=${updatedAcq}.`,
  );
}

async function upsertItem(
  supabase: ReturnType<typeof admin>,
  p: ItemPayload,
): Promise<string> {
  // Try to find an existing item by (source, external_id) first.
  const { data: existing } = await supabase
    .from("item_externals")
    .select("item_id")
    .eq("source", p.external_source)
    .eq("external_id", p.external_id)
    .maybeSingle<{ item_id: string }>();

  const itemFields: Record<string, unknown> = {
    category: p.category,
    title: p.title,
    original_title: p.original_title ?? null,
    year: p.year,
    cover_url: p.cover_url,
    rating: p.rating,
    play_count: p.play_count,
    status: p.status,
    comment: p.comment,
    min_players: p.min_players,
    max_players: p.max_players,
    playing_time_min: p.playing_time_min,
    age_min: p.age_min,
    designers: p.designers,
    artists: p.artists,
    themes: p.themes,
    mechanics: p.mechanics,
    platforms: p.platforms ?? [],
    genres: p.genres ?? [],
    developers: p.developers ?? [],
    publishers: p.publishers ?? [],
    franchises: p.franchises ?? [],
    release_date: p.release_date ?? null,
    cost: p.cost,
  };
  // Only set created_at when the seed has an authoritative source (e.g. Grouvee
  // date_added_to_collection); otherwise let Postgres default keep its value.
  if (p.created_at) itemFields.created_at = p.created_at;

  let itemId: string;
  if (existing?.item_id) {
    itemId = existing.item_id;
    const { error } = await supabase
      .from("items")
      .update(itemFields)
      .eq("id", itemId);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await supabase
      .from("items")
      .insert(itemFields)
      .select("id")
      .single<{ id: string }>();
    if (error || !inserted) throw error ?? new Error("Insert failed");
    itemId = inserted.id;
  }

  await supabase.from("item_externals").upsert(
    {
      item_id: itemId,
      source: p.external_source,
      external_id: p.external_id,
      url: p.external_url,
    },
    { onConflict: "item_id,source" },
  );

  return itemId;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const supabase = admin();

  if (reset) {
    if (!(await confirm("Truncate items, plays, item_externals, play_participants?"))) {
      console.log("Aborted.");
      process.exit(0);
    }
    console.log("Truncating...");
    await supabase.from("play_participants").delete().gt("name", "");
    await supabase.from("plays").delete().gt("source", "");
    await supabase.from("item_externals").delete().gt("source", "");
    await supabase.from("items").delete().gt("title", "");
  }

  await seedBoardgames(supabase);
  await seedBgg(supabase);
  await seedVideogames(supabase);

  // Final tally
  const [{ count: itemCount }, { count: playCount }, { count: externalCount }] =
    await Promise.all([
      supabase.from("items").select("*", { count: "exact", head: true }),
      supabase.from("plays").select("*", { count: "exact", head: true }),
      supabase.from("item_externals").select("*", { count: "exact", head: true }),
    ]);
  console.log("\n--- summary ---");
  console.log(`items:          ${itemCount}`);
  console.log(`plays:          ${playCount}`);
  console.log(`item_externals: ${externalCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
