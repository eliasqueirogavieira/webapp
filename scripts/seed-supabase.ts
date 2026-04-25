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

function statusFromShelves(raw: string | undefined): string | null {
  const keys = namesFromJsonMap(raw).map((k) => k.toLowerCase());
  if (keys.includes("played")) return "played";
  if (keys.includes("playing") || keys.includes("backlog")) return "backlog";
  if (keys.includes("wishlist")) return "wishlist";
  if (keys.includes("abandoned")) return "abandoned";
  return null;
}

function statusFromBoardgame(b: BoardgameRecord): string | null {
  if (b.played) return "played";
  if (b.owned) return "owned";
  if (b.wishlist) return "wishlist";
  if (b.favorite) return "favorite";
  return null;
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
  platforms?: string[];
  genres?: string[];
  developers?: string[];
  publishers?: string[];
  franchises?: string[];
  release_date?: string | null;
  cost: number | null;
  external_id: string;
  external_source: string;
  external_url: string | null;
};

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

  const itemFields = {
    category: p.category,
    title: p.title,
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
