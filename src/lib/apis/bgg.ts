import { XMLParser } from "fast-xml-parser";

/**
 * BoardGameGeek XML API2 wrapper.
 * Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
 *
 * Auth model:
 *   1. Bearer "application token" via Authorization header — required for ALL
 *      xmlapi2 traffic since 2026. Get one at
 *      https://boardgamegeek.com/applications (approval ~1 week).
 *   2. Session cookie via POST /login/api/v1 — required for the <privateinfo>
 *      block (acquisitiondate, pricepaid, …) on collection responses.
 *      Bearer alone returns the collection but omits private fields.
 *
 * Pace at ~1 req/sec; batch /thing requests with comma-separated ids.
 */

const BGG = "https://boardgamegeek.com/xmlapi2";
const LOGIN_URL = "https://boardgamegeek.com/login/api/v1";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  textNodeName: "_text",
  // Force these elements into arrays even when only one is present.
  // IMPORTANT: skip attributes — `<rank name="boardgame">` would otherwise
  // surface as `name: ["boardgame"]` because of the `name` element entry.
  isArray: (name, _jpath, _isLeafNode, isAttribute) =>
    !isAttribute && ["item", "link", "name", "rank"].includes(name),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- session cookie ------------------------------------------------------

let sessionCookie: string | null = null;

async function bggLogin(): Promise<string> {
  if (sessionCookie) return sessionCookie;
  const username = process.env.BGG_USERNAME;
  const password = process.env.BGG_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "BGG_USERNAME / BGG_PASSWORD missing in env — required to read " +
        "<privateinfo> (acquisitiondate, pricepaid, …) from BGG collection.",
    );
  }
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credentials: { username, password } }),
  });
  if (!res.ok) {
    throw new Error(`BGG login ${res.status}: ${await res.text().catch(() => "")}`);
  }
  // Node's fetch surfaces multiple Set-Cookie headers via getSetCookie().
  // Combine them into a single Cookie request header for follow-up calls.
  const cookies =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    [];
  const joined = cookies.map((c) => c.split(";", 1)[0].trim()).filter(Boolean).join("; ");
  if (!joined) throw new Error("BGG login returned no Set-Cookie header");
  sessionCookie = joined;
  return sessionCookie;
}

/** Force a re-login on the next authenticated request (e.g. after a 401). */
function clearSessionCookie() {
  sessionCookie = null;
}

// ---- fetch -----------------------------------------------------------------

type FetchOpts = { authenticated?: boolean };

async function fetchXml(url: string, opts: FetchOpts = {}, attempts = 6): Promise<unknown> {
  const token = process.env.BGG_AUTH_TOKEN;
  for (let i = 0; i < attempts; i++) {
    const headers: Record<string, string> = {
      "User-Agent":
        "collection-tracker/0.1 (https://github.com/eliasqueirogavieira/webapp)",
      Accept: "application/xml, text/xml, */*",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.authenticated) headers.Cookie = await bggLogin();

    const res = await fetch(url, { headers });
    // BGG returns 202 while it queues the response; wait and retry.
    if (res.status === 202) {
      await sleep(1500 * (i + 1));
      continue;
    }
    if (res.status === 429) {
      await sleep(5000 * (i + 1));
      continue;
    }
    if (res.status === 401) {
      // If we sent a session cookie, it may have expired — re-login once.
      if (opts.authenticated && sessionCookie) {
        clearSessionCookie();
        continue;
      }
      throw new Error(
        token
          ? `BGG 401: token rejected. Check BGG_AUTH_TOKEN / BGG_PASSWORD.`
          : `BGG 401: this endpoint now requires a registered application token. ` +
            `Apply at https://boardgamegeek.com/applications and set BGG_AUTH_TOKEN in .env.local.`,
      );
    }
    if (!res.ok) throw new Error(`BGG ${res.status}: ${url}`);
    const text = await res.text();
    return parser.parse(text);
  }
  throw new Error(`BGG never returned 200 after ${attempts} attempts: ${url}`);
}

// ---- search / things ------------------------------------------------------

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
  designers: string[];
  type: string;
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
  // BGG returns numeric ranks as numbers and "Not Ranked" as the literal
  // string "Not Ranked"; only accept the former.
  const overallRankRaw = rankArr.find(
    (r) => r.name === "boardgame" && r.type === "subtype",
  )?.value;
  const bggRank = typeof overallRankRaw === "number" ? overallRankRaw : null;

  const linksOf = (type: string) =>
    links.filter((l) => l.type === type).map((l) => String(l.value));

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
    bggRank,
    mechanics: linksOf("boardgamemechanic"),
    categories: linksOf("boardgamecategory"),
    designers: linksOf("boardgamedesigner"),
    type: String(it.type),
  };
}

// ---- collection -----------------------------------------------------------

export type BggSubtype = "boardgame" | "boardgameexpansion" | "boardgameaccessory";

export type BggCollectionRow = {
  id: string; // BGG objectid
  collid: string;
  name: string;
  yearpublished: number | null;
  image: string | null;
  thumbnail: string | null;
  subtype: BggSubtype;
  status: {
    own: boolean;
    prevowned: boolean;
    preordered: boolean;
    wishlist: boolean;
    wishlistpriority: number | null; // 1 (most wanted) – 5
    wanttobuy: boolean;
    wanttoplay: boolean;
    fortrade: boolean;
    /** BGG-formatted "YYYY-MM-DD HH:MM:SS" (UTC). */
    lastmodified: string | null;
  };
  numplays: number;
  rating: number | null;
  comment: string | null;
  wishlistcomment: string | null;
  privateinfo: {
    acquisitiondate: string | null; // YYYY-MM-DD
    pricepaid: number | null;
    ppCurrency: string | null;
    currvalue: number | null;
    cvCurrency: string | null;
    acquiredfrom: string | null;
    quantity: number;
    inventorylocation: string | null;
  } | null;
};

/**
 * Fetch a user's full BGG collection.
 *
 * If BGG_PASSWORD is set we POST /login/api/v1 first and pass the resulting
 * session cookie, which causes BGG to include the <privateinfo> block
 * (acquisitiondate, pricepaid, …) for the user's own username. Without a
 * password the call still works but private fields are omitted.
 */
export async function bggCollection(
  username: string,
  opts: { wishlist?: boolean; modifiedsince?: string } = {},
): Promise<BggCollectionRow[]> {
  const havePassword = Boolean(process.env.BGG_PASSWORD);
  const params = new URLSearchParams({
    username,
    stats: "1",
    brief: "0",
  });
  if (havePassword) params.set("showprivate", "1");
  if (opts.wishlist) params.set("wishlist", "1");
  if (opts.modifiedsince) params.set("modifiedsince", opts.modifiedsince);

  const url = `${BGG}/collection?${params.toString()}`;
  const doc = (await fetchXml(url, { authenticated: havePassword })) as {
    items?: { item?: unknown[] };
  };
  const items = doc.items?.item ?? [];
  return (items as Array<Record<string, unknown>>).map(parseCollectionRow);
}

function parseCollectionRow(it: Record<string, unknown>): BggCollectionRow {
  const status = (it.status as Record<string, unknown>) ?? {};
  const priv = it.privateinfo as Record<string, unknown> | undefined;

  return {
    id: String(it.objectid ?? ""),
    collid: String(it.collid ?? ""),
    name: pickCollectionName(it.name),
    yearpublished: pickInt(it.yearpublished),
    image: (it.image as string) ?? null,
    thumbnail: (it.thumbnail as string) ?? null,
    subtype: ((it.subtype as string) ?? "boardgame") as BggSubtype,
    status: {
      own: status.own === 1 || status.own === "1",
      prevowned: status.prevowned === 1 || status.prevowned === "1",
      preordered: status.preordered === 1 || status.preordered === "1",
      wishlist: status.wishlist === 1 || status.wishlist === "1",
      wishlistpriority: pickInt(status.wishlistpriority),
      wanttobuy: status.wanttobuy === 1 || status.wanttobuy === "1",
      wanttoplay: status.wanttoplay === 1 || status.wanttoplay === "1",
      fortrade: status.fortrade === 1 || status.fortrade === "1",
      lastmodified: (status.lastmodified as string) || null,
    },
    numplays: pickInt(it.numplays) ?? 0,
    rating: pickRating((it.stats as Record<string, unknown>)?.rating),
    comment: pickText(it.comment),
    wishlistcomment: pickText(it.wishlistcomment),
    privateinfo: priv
      ? {
          acquisitiondate: (priv.acquisitiondate as string) || null,
          pricepaid: pickFloat(priv.pricepaid),
          ppCurrency: (priv.pp_currency as string) || null,
          currvalue: pickFloat(priv.currvalue),
          cvCurrency: (priv.cv_currency as string) || null,
          acquiredfrom: (priv.acquiredfrom as string) || null,
          quantity: pickInt(priv.quantity) ?? 1,
          inventorylocation: (priv.inventorylocation as string) || null,
        }
      : null,
  };
}

// ---- helpers --------------------------------------------------------------

function pickPrimaryName(name: unknown): string {
  if (Array.isArray(name)) {
    const primary = name.find(
      (n: Record<string, unknown>) => n.type === "primary",
    ) as Record<string, unknown> | undefined;
    const pick = primary ?? name[0];
    return String(pick?.value ?? pick?._text ?? "");
  }
  if (typeof name === "object" && name !== null) {
    const n = name as Record<string, unknown>;
    return String(n.value ?? n._text ?? "");
  }
  return "";
}

/** /collection emits `<name sortindex="1">Title</name>` (text child, no value attr). */
function pickCollectionName(name: unknown): string {
  if (Array.isArray(name)) {
    const first = name[0] as Record<string, unknown> | undefined;
    return String(first?._text ?? first?.value ?? "");
  }
  if (typeof name === "object" && name !== null) {
    const n = name as Record<string, unknown>;
    return String(n._text ?? n.value ?? "");
  }
  return typeof name === "string" ? name : "";
}

function pickInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const raw = obj.value !== undefined ? obj.value : obj._text;
    return pickInt(raw);
  }
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function pickFloat(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const raw = obj.value !== undefined ? obj.value : obj._text;
    return pickFloat(raw);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickYear(v: unknown): number | null {
  return pickInt(v);
}

function pickText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.length ? v : null;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const t = obj._text ?? obj.value;
    return typeof t === "string" && t.length ? t : null;
  }
  return null;
}

function pickRating(v: unknown): number | null {
  // Collection <rating value="7"> for rated, <rating value="N/A"> otherwise.
  if (!v || typeof v !== "object") return null;
  const raw = (v as Record<string, unknown>).value;
  if (raw === "N/A" || raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
