# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Next.js dev server against the configured Supabase project.
- `npm run dev:preview` — `PREVIEW_MODE=1` dev server backed by local JSONs/CSVs in `data/` (no Supabase needed). Pages branch via `isPreviewMode()` in `src/lib/preview.ts`.
- `npm run build` / `npm start` — production build / serve.
- `npm run lint` — ESLint via `eslint-config-next`.
- No test runner configured. `tsc` runs as part of `next build`; there is no separate typecheck script.

Data pipeline scripts (all `tsx`, load env via `scripts/_load-env.ts`):

- `npm run enrich:boardgames` — Ludopedia → `data/preview-boardgames.json`.
- `npm run enrich:bgg` — BGG XML API2 → `data/preview-bgg.json` (requires `BGG_AUTH_TOKEN` + `BGG_PASSWORD` for `privateinfo`).
- `npm run enrich:preview` — IGDB → `data/preview-covers.json`.
- `npm run seed:supabase` — idempotent upsert from the JSON caches into Supabase (the cron + in-app "Sincronizar agora" button run `enrich:boardgames` → `seed:supabase`).
- `npm run import:grouvee` — legacy Grouvee CSV importer (writes Supabase directly, bypasses the JSON cache).

## Architecture

### Polymorphic content model
One `items` table holds every category (`boardgame`, `videogame`, `movie`, `series`, `restaurant`) with sparse category-specific columns. External IDs live in a separate `item_externals(item_id, source, external_id, url)` table — slug routing depends on this. Plays + `play_participants` are a child hierarchy used by board games today. See `supabase/migrations/`.

`items.status` is a `text[]` (after migration `20260508`), not a single enum — items can be both `owned` and `wishlist`. Treat single-string `status` values defensively when reading (see `normalizeStatus` in `src/lib/data.ts`); the schema's `item_status` enum is now unused but still defined.

### Slugs are derived, not stored
Routes use `${source}-${external_id}` slugs (`ludo-12345`, `igdb-9999`, `grouvee-…`, `bgg-…`). The source preference order per category lives in `slugForItem()` (`src/lib/data.ts`); resolution back to a UUID goes through `lookupItemId()` against `item_externals`. When adding new external sources, register the prefix in `SLUG_PREFIX_TO_SOURCE` too.

### Categories are config-driven
`src/lib/categories.ts` is the single source of truth. Adding a category = appending a `CategoryConfig` + setting `enabled: true` + creating a route wrapper at `src/app/(app)/<slug>/page.tsx`. Nav, hero, home-page stats sections, and the `/add` flow all iterate `ENABLED_CATEGORIES`.

### Two backends behind one data API
Pages always import from `src/lib/data.ts`. It dispatches between Supabase (`src/lib/supabase/server.ts`) and the preview JSON loader (`src/lib/preview.ts`) based on `PREVIEW_MODE`. Keep both paths in sync when changing data shapes — `ItemCardData`, `BoardgameDetail`, `VideogameDetail` are shared types consumed by UI components.

### Route groups split the shell
- `src/app/(landing)/` — homepage, no sidebar.
- `src/app/(app)/` — everything else; the layout renders the sidebar and is forced dynamic (`export const dynamic = "force-dynamic"` + `noStore()`) so owner-only buttons reflect the current session on every render. Don't add caching headers here without understanding why this is required.

### Owner auth (single-tenant)
- `OWNER_EMAIL` env var gates who can claim ownership. On every `(app)` render, `ensureOwnerClaim()` upserts the signed-in user into `owner_config` if their email matches.
- `is_owner()` Postgres function + RLS policies on every table enforce owner-only writes; public read is open across all content.
- Server actions and the `/api/sync` route all call `isOwner()` before touching the admin client.
- `DEV_AUTH_BYPASS=1` fakes an owner session (used for Playwright smoke tests). Never enable in production.

### Three Supabase clients, three purposes
- `supabase/server.ts` — SSR client with cookie-bound session; respects RLS as the current user. Use in Server Components, page loaders, and route handlers that read.
- `supabase/client.ts` — browser SSR client (rarely needed; most writes go through server actions).
- `supabase/admin.ts` — service-role client that bypasses RLS. Only call after verifying ownership; never reach for it from a Client Component.

### Add-item adapter pattern
`/add` is generic. Each writable category implements a `CategoryAdapter` (`src/lib/add-adapters/types.ts`) exposing `search()` + `import()`. The registry lives in `src/lib/add-adapters/index.ts`. Server actions in `src/app/(app)/add/actions.ts` look up the adapter by category and never know anything about BGG/IGDB specifics.

### Sync paths
Ludopedia → Supabase syncs through two entry points that converge on the same scripts:
1. `.github/workflows/sync-ludopedia.yml` daily cron (`enrich:boardgames` → `seed:supabase`).
2. `POST /api/sync` (owner-only) calls GitHub's `workflow_dispatch` for the same workflow. Requires `GH_DISPATCH_TOKEN` (fine-grained PAT, `Actions: read/write`).

### External API wrappers
`src/lib/apis/{bgg,igdb,ludopedia}.ts` are typed wrappers. BGG needs both Bearer auth and a session cookie for `privateinfo` (acquisition date, price, etc.) — see `.env.example` for `BGG_AUTH_TOKEN` + `BGG_PASSWORD`. Ludopedia takes a personal token; IGDB auth goes through Twitch (`TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`).

## Conventions

- Path alias `@/*` → `src/*` (configured in `tsconfig.json`).
- `next/image` allowlist is in `next.config.ts` — when ingesting a new cover host, add it there or images will 500.
- Server actions live next to the route that uses them (`page.tsx` + `actions.ts`); they always check `isOwner()` first.
- `revalidatePath("/", "layout")` is the standard cache-bust after a write — detail pages key off external slugs, not UUIDs, so layout-level revalidation is necessary to refresh both the listing and the detail view.
- `data/` is gitignored except `data/bgg-aliases.json` (hand-curated, the sync depends on it).
