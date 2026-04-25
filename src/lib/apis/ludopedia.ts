/**
 * Ludopedia API wrapper.
 * Docs: https://ludopedia.com.br/wiki/API
 *
 * Auth: a personal API access token, generated from your Ludopedia profile
 * (Configurações → API de acesso → Gerar token). No OAuth flow needed — just
 * paste the token into .env.local as LUDOPEDIA_TOKEN.
 */

const BASE = "https://ludopedia.com.br/api/v1";

type LudopediaHit = {
  id_jogo: number;
  nm_jogo: string;
  nm_original?: string;
  ano_publicacao?: number;
  thumb?: string;
  link?: string;
};

export type LudopediaJogo = {
  id_jogo: number;
  nm_jogo: string;
  nm_original?: string;
  ano_publicacao?: number;
  ano_nacional?: number;
  qt_jogadores_min?: number;
  qt_jogadores_max?: number;
  vl_tempo_jogo?: number;
  idade_minima?: number;
  thumb?: string;
  link?: string;
  mecanicas?: Array<{ id_mecanica: number; nm_mecanica: string }>;
  temas?: Array<{ id_tema: number; nm_tema: string }>;
  categorias?: Array<{ id_categoria: number; nm_categoria: string }>;
  artistas?: Array<{ id_profissional: number; nm_profissional: string }>;
  designers?: Array<{ id_profissional: number; nm_profissional: string }>;
  qt_tem?: number;
  qt_favorito?: number;
  qt_jogou?: number;
};

export type LudopediaJogador = {
  nome: string;
  id_usuario: number | null;
  id_partida_jogador?: number;
  fl_vencedor: 0 | 1;
  vl_pontos: number | null;
  observacao?: string;
  thumb?: string;
};

export type LudopediaPartida = {
  id_partida: number;
  dt_partida: string;            // YYYY-MM-DD
  duracao: number | null;        // minutes
  qt_partidas: number;            // number of plays bundled in this entry
  descricao?: string;
  jogadores: LudopediaJogador[];
  expansoes: Array<{ id_jogo: number; nm_jogo: string }>;
};

export type LudopediaColecaoRow = {
  id_jogo: number;
  nm_jogo: string;
  thumb?: string;
  link?: string;
  fl_tem: 0 | 1 | null;
  fl_quer: 0 | 1 | null;
  fl_jogou: 0 | 1 | null;
  fl_teve: 0 | 1 | null;
  fl_favorito: 0 | 1 | null;
  vl_nota: number | null;
  comentario: string | null;
  qt_partidas: number | null;
  comentario_privado: string | null;
  vl_custo: number | null;
  tags: unknown[];
};

/**
 * The API only hands out the `_t` (thumbnail) URL, but the same filename
 * without the suffix resolves to the full-size cover on the same bucket.
 */
export function upgradeLudopediaCover(thumbUrl: string | undefined): string | undefined {
  if (!thumbUrl) return undefined;
  return thumbUrl.replace(/_t(\.[a-z]+)(\?.*)?$/i, "$1$2");
}

async function ludoFetch<T>(path: string, attempt = 0): Promise<T> {
  const token = process.env.LUDOPEDIA_TOKEN;
  if (!token) throw new Error("LUDOPEDIA_TOKEN missing in env");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "collection-tracker/0.1",
    },
  });
  if (res.status === 429 && attempt < 2) {
    const body = await res.text();
    // e.g. "Acesso bloqueado. Motivo: temporary_ban. Tente novamente em 294 segundos."
    const m = body.match(/em\s+(\d+)\s+segundos/i);
    const wait = (m ? Number(m[1]) : 60) * 1000 + 2000;
    console.warn(
      `Ludopedia 429 — waiting ${Math.round(wait / 1000)}s before retry...`,
    );
    await new Promise((r) => setTimeout(r, wait));
    return ludoFetch<T>(path, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ludopedia ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function ludopediaSearch(name: string): Promise<LudopediaHit[]> {
  // Ludopedia's search endpoint 500s on apostrophes (server-side bug).
  // Replace with a space so "Andromeda's Edge" still tokenizes into "Andromeda" + "Edge"
  // — stripping the apostrophe entirely collapses to "Andromedas Edge" which returns 0 hits.
  const sanitized = name.replace(/['’`]/g, " ").replace(/\s+/g, " ").trim();
  const q = encodeURIComponent(sanitized);
  const body = await ludoFetch<{ jogos: LudopediaHit[] }>(
    `/jogos?search=${q}&rows=10`,
  );
  return body.jogos ?? [];
}

export async function ludopediaGame(id: number | string): Promise<LudopediaJogo | null> {
  try {
    return await ludoFetch<LudopediaJogo>(`/jogos/${id}`);
  } catch {
    return null;
  }
}

/**
 * Full collection for a user — all games + the owner's personal data
 * (rating `vl_nota`, play count, ownership flags, comments, cost).
 */
export async function ludopediaCollection(
  idUsuario: number | string,
): Promise<LudopediaColecaoRow[]> {
  const all: LudopediaColecaoRow[] = [];
  let page = 1;
  const rows = 100;
  while (true) {
    const body = await ludoFetch<{
      colecao: LudopediaColecaoRow[];
      total?: number;
    }>(`/colecao?id_usuario=${idUsuario}&rows=${rows}&page=${page}`);
    const batch = body.colecao ?? [];
    all.push(...batch);
    if (batch.length < rows) break;
    page++;
    if (page > 50) break;
  }
  return all;
}

/**
 * All plays for a given Ludopedia game id, scoped to the token's owner.
 * Returns the latest first. The endpoint paginates with rows/page; we collect all.
 */
export async function ludopediaPlays(idJogo: number | string): Promise<LudopediaPartida[]> {
  const all: LudopediaPartida[] = [];
  let page = 1;
  const rows = 50;
  while (true) {
    const body = await ludoFetch<{
      partidas: LudopediaPartida[];
      total?: number;
    }>(`/partidas?id_jogo=${idJogo}&rows=${rows}&page=${page}`);
    const batch = body.partidas ?? [];
    all.push(...batch);
    if (batch.length < rows) break;
    page++;
    if (page > 100) break; // safety
  }
  return all;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const STOPWORDS = new Set(["and", "the", "of", "a", "an", "&"]);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  );

function tokenSetEquivalent(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (!tb.has(t)) return false;
  for (const t of tb) if (!ta.has(t)) return false;
  return true;
}

export function pickBestLudopediaMatch(
  name: string,
  year: number | null,
  hits: LudopediaHit[],
): LudopediaHit | null {
  if (hits.length === 0) return null;
  const target = norm(name);
  // Ludopedia often has both nm_jogo (Portuguese) and nm_original (English) —
  // match against whichever the caller passed.
  const strictMatch = (h: LudopediaHit) =>
    norm(h.nm_jogo) === target || norm(h.nm_original ?? "") === target;
  // Looser: same set of meaningful tokens, ignoring "and"/"&"/"the" etc.
  // e.g. "Arcs: Leaders & Lore Pack" ≡ "Arcs: Leaders and Lore Pack".
  const looseMatch = (h: LudopediaHit) =>
    tokenSetEquivalent(name, h.nm_jogo) ||
    tokenSetEquivalent(name, h.nm_original ?? "");

  if (year !== null) {
    const withYear = hits.find(
      (h) =>
        (strictMatch(h) || looseMatch(h)) &&
        Number(h.ano_publicacao) === year,
    );
    if (withYear) return withYear;
  }
  const strict = hits.find(strictMatch);
  if (strict) return strict;
  const loose = hits.find(looseMatch);
  return loose ?? null;
}
