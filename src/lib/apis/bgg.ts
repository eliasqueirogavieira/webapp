import { XMLParser } from "fast-xml-parser";

/**
 * BoardGameGeek XML API2 wrapper.
 * Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
 * No auth required. Rate-limit yourself: keep under ~1 req/sec and batch with comma-separated ids.
 */

const BGG = "https://boardgamegeek.com/xmlapi2";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  // force these into arrays even when a single element is present
  isArray: (name) => ["item", "link", "name", "rank"].includes(name),
});

async function fetchXml(url: string, attempts = 6): Promise<unknown> {
  // BGG now requires a registered application token for all XML API traffic.
  // Get one at https://boardgamegeek.com/applications (approval can take up to a week).
  const token = process.env.BGG_AUTH_TOKEN;
  const headers: Record<string, string> = {
    "User-Agent":
      "collection-tracker/0.1 (https://github.com/eliasqueirogavieira/webapp)",
    Accept: "application/xml, text/xml, */*",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers });
    // BGG returns 202 while it queues the response; wait and retry.
    if (res.status === 202) {
      await sleep(1500 * (i + 1));
      continue;
    }
    // 429 = rate limited; back off and retry.
    if (res.status === 429) {
      await sleep(5000 * (i + 1));
      continue;
    }
    if (res.status === 401) {
      const msg = token
        ? `BGG 401: token rejected. Check BGG_AUTH_TOKEN.`
        : `BGG 401: this endpoint now requires a registered application token. ` +
          `Apply at https://boardgamegeek.com/applications and set BGG_AUTH_TOKEN in .env.local.`;
      throw new Error(msg);
    }
    if (!res.ok) throw new Error(`BGG ${res.status}: ${url}`);
    const text = await res.text();
    return parser.parse(text);
  }
  throw new Error(`BGG never returned 200 after ${attempts} attempts: ${url}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BggSearchResult = {
  id: string;
  name: string;
  year: number | null;
  type: string;
};

export async function bggSearch(query: string): Promise<BggSearchResult[]> {
  const url = `${BGG}/search?query=${encodeURIComponent(
    query,
  )}&type=boardgame,boardgameexpansion`;
  const doc = (await fetchXml(url)) as { items?: { item?: unknown[] } };
  const items = doc.items?.item ?? [];
  return (items as Array<Record<string, unknown>>).map((it) => ({
    id: String(it.id),
    name: pickPrimaryName(it.name),
    year: pickYear(it.yearpublished),
    type: String(it.type),
  }));
}

export type BggThing = {
  id: string;
  name: string;
  year: number | null;
  image: string | null;
  thumbnail: string | null;
  description: string;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTimeMin: number | null;
  weight: number | null;
  bggRank: number | null;
  mechanics: string[];
  categories: string[];
  bestPlayers: number[];
  type: string;
  raw: unknown;
};

export async function bggThings(ids: string[]): Promise<BggThing[]> {
  if (ids.length === 0) return [];
  const url = `${BGG}/thing?id=${ids.join(",")}&stats=1`;
  const doc = (await fetchXml(url)) as { items?: { item?: unknown[] } };
  const items = doc.items?.item ?? [];
  return (items as Array<Record<string, unknown>>).map((it) => parseThing(it));
}

function parseThing(it: Record<string, unknown>): BggThing {
  const links = (it.link as Array<Record<string, unknown>>) ?? [];
  const stats = it.statistics as Record<string, unknown> | undefined;
  const ratings = (stats?.ratings ?? {}) as Record<string, unknown>;
  const ranks = (ratings.ranks as Record<string, unknown>) ?? {};
  const rankArr = (ranks.rank as Array<Record<string, unknown>>) ?? [];
  const overallRank = rankArr.find((r) => r.name === "boardgame");

  const mechanics = links
    .filter((l) => l.type === "boardgamemechanic")
    .map((l) => String(l.value));
  const categories = links
    .filter((l) => l.type === "boardgamecategory")
    .map((l) => String(l.value));

  return {
    id: String(it.id),
    name: pickPrimaryName(it.name),
    year: pickYear(it.yearpublished),
    image: (it.image as string) ?? null,
    thumbnail: (it.thumbnail as string) ?? null,
    description: String(it.description ?? ""),
    minPlayers: pickInt(it.minplayers),
    maxPlayers: pickInt(it.maxplayers),
    playingTimeMin: pickInt(it.playingtime),
    weight: pickFloat(
      (ratings.averageweight as Record<string, unknown>)?.value,
    ),
    bggRank: pickInt(overallRank?.value),
    mechanics,
    categories,
    bestPlayers: [],
    type: String(it.type),
    raw: it,
  };
}

function pickPrimaryName(name: unknown): string {
  if (Array.isArray(name)) {
    const primary = name.find(
      (n: Record<string, unknown>) => n.type === "primary",
    ) as Record<string, unknown> | undefined;
    return String((primary ?? name[0])?.value ?? "");
  }
  if (typeof name === "object" && name !== null) {
    return String((name as Record<string, unknown>).value ?? "");
  }
  return "";
}

function pickInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const obj = v as Record<string, unknown>;
  const raw = obj?.value !== undefined ? obj.value : v;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pickFloat(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickYear(v: unknown): number | null {
  return pickInt(v);
}
