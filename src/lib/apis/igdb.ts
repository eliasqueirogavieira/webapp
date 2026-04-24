/**
 * IGDB v4 API wrapper.
 * Docs: https://api-docs.igdb.com/
 * Auth: Twitch client credentials → bearer token (cached in process).
 * Rate limit: 4 req/s. Use comma-id batching to minimize calls.
 */

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_BASE = "https://api.igdb.com/v4";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getToken(): Promise<string> {
  const manual = process.env.IGDB_ACCESS_TOKEN;
  if (manual) return manual;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET");
  }

  const res = await fetch(
    `${TWITCH_TOKEN_URL}?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Twitch OAuth ${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return tokenCache.token;
}

async function igdbQuery<T>(endpoint: string, apicalypse: string): Promise<T[]> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error("Missing TWITCH_CLIENT_ID");
  const token = await getToken();
  const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: apicalypse,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB ${res.status}: ${text}`);
  }
  return (await res.json()) as T[];
}

export type IgdbGame = {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
  platforms?: { name: string }[];
  genres?: { name: string }[];
  involved_companies?: {
    company: { name: string };
    developer: boolean;
    publisher: boolean;
  }[];
  franchises?: { name: string }[];
  summary?: string;
};

const GAMES_FIELDS = `
  name,
  summary,
  cover.image_id,
  first_release_date,
  platforms.name,
  genres.name,
  involved_companies.company.name,
  involved_companies.developer,
  involved_companies.publisher,
  franchises.name
`;

export async function igdbByIds(ids: (string | number)[]): Promise<IgdbGame[]> {
  if (ids.length === 0) return [];
  const list = ids.join(",");
  const q = `fields ${GAMES_FIELDS}; where id = (${list}); limit ${ids.length};`;
  return igdbQuery<IgdbGame>("games", q);
}

export async function igdbSearch(query: string, limit = 10): Promise<IgdbGame[]> {
  const escaped = query.replace(/"/g, '\\"');
  const q = `fields ${GAMES_FIELDS}; search "${escaped}"; limit ${limit};`;
  return igdbQuery<IgdbGame>("games", q);
}

export function igdbCoverUrl(imageId: string, size: "cover_big" | "1080p" = "cover_big") {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function igdbSplitCompanies(game: IgdbGame) {
  const developers =
    game.involved_companies
      ?.filter((c) => c.developer)
      .map((c) => c.company?.name)
      .filter((n): n is string => !!n) ?? [];
  const publishers =
    game.involved_companies
      ?.filter((c) => c.publisher)
      .map((c) => c.company?.name)
      .filter((n): n is string => !!n) ?? [];
  return { developers, publishers };
}

export function igdbReleaseDate(game: IgdbGame): string | null {
  if (!game.first_release_date) return null;
  return new Date(game.first_release_date * 1000).toISOString().slice(0, 10);
}
