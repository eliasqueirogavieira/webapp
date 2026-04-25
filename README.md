# Collection

Personal catalog of board games, video games, movies, series, and restaurants — rated 0–10, with live lookups against BoardGameGeek and IGDB. Public read, private edit.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + RLS)
- Hosting: Vercel

## Getting started

### 1. Install deps

```bash
npm install
```

### 2. Create your Supabase project

1. Sign up at [supabase.com](https://supabase.com), create a new project.
2. Grab `Project URL`, `anon` key, and `service_role` key from *Settings → API*.
3. Copy `.env.example` to `.env.local` and fill in the three `SUPABASE_*` vars.

### 3. Apply the schema

Two options:

- **CLI (recommended):** install [`supabase` CLI](https://supabase.com/docs/guides/cli), run `supabase link --project-ref <ref>`, then `supabase db push`.
- **Manual:** open the Supabase SQL editor and paste the contents of `supabase/migrations/20260424000001_init.sql`.

### 4. Register yourself as owner

1. Run `npm run dev`, go to <http://localhost:3000/login>, sign in with Google.
2. In the Supabase SQL editor, run (replacing with your UUID from `auth.users`):
   ```sql
   insert into owner_config(user_id) values ('<your-uuid>');
   ```

### 5. Import your existing CSVs

Put your CSV exports in `data/`:
- `data/collection.csv` — BoardGameGeek export
- `data/oktano_*_grouvee_*.csv` — Grouvee export

Then:

```bash
npm run import:bgg        # board games
npm run import:grouvee    # video games
# or both:
npm run import:all
```

The Grouvee import does IGDB enrichment (covers, genres, platforms). To enable it, register a Twitch app at <https://dev.twitch.tv/console/apps> and set `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` in `.env.local`.

### 6. Run the app

```bash
npm run dev
```

<http://localhost:3000>

## Adding new items

After signup + owner registration, `/add` is available in the sidebar. Search by title — BGG for board games, IGDB for video games — click a result to add it. Full metadata is pulled and stored. Then edit rating / status from the detail page.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: *New Project → Import*, select the repo.
3. Paste the same env vars from `.env.local`.
4. Deploy.

Add your Vercel URL to Supabase *Authentication → URL Configuration → Site URL* and *Redirect URLs* so Google OAuth works in prod.

## Sync (Ludopedia → Supabase)

Two ways the database stays current with what you change on Ludopedia
(ratings, plays, new games):

- **Daily cron** — `.github/workflows/sync-ludopedia.yml` runs at
  04:00 UTC (= 01:00 BRT). It executes `npm run enrich:boardgames`
  (pulls `/colecao` + `/jogos/{id}` + `/partidas`) and then
  `npm run seed:supabase` (idempotent upsert).
- **"Sincronizar agora" sidebar button** — owner-only. Posts to
  `/api/sync`, which dispatches the same workflow on demand. The
  button shows a "Iniciado · ver no GitHub" link to the run.

### Setup (one-time)

1. **GitHub repo secrets** (`Settings → Secrets and variables → Actions`):
   - `LUDOPEDIA_TOKEN`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. **GitHub PAT for the in-app button** (`github.com/settings/tokens`):
   fine-grained token scoped to `eliasqueirogavieira/webapp` with
   `Actions: Read and write`. Save as `GH_DISPATCH_TOKEN` in Vercel
   env vars.

## Project layout

```
.github/workflows/
  sync-ludopedia.yml      Daily cron + workflow_dispatch sync
src/
  app/
    layout.tsx            Root html/body shell only
    (landing)/            Home page (no sidebar)
    (app)/                Sidebar layout + every other route
      boardgames/         List + detail + plays
      videogames/         List + detail
      login/, add/, auth/
    api/sync/route.ts     Owner-gated workflow_dispatch trigger
  components/             ItemCard, StarRating, PlaysPanel, SyncButton, …
  lib/
    categories.ts         Single source of truth for categories
    data.ts               Unified loaders (preview ↔ Supabase)
    preview.ts            JSON-backed preview path
    supabase/             SSR + browser + admin clients
    apis/                 IGDB, Ludopedia, BGG wrappers
    ratings.ts            Rating scale conversions
    auth.ts               Owner check
scripts/
  enrich-ludopedia.ts     Pulls Ludopedia → preview-boardgames.json
  enrich-preview.ts       Pulls IGDB → preview-covers.json
  import-grouvee.ts       Legacy Grouvee CSV importer (Supabase direct)
  seed-supabase.ts        One-shot seed from local JSONs into Supabase
supabase/migrations/      Schema + RLS policies
data/                     Local JSON caches + Grouvee CSV (gitignored)
```

## Future

- Movies + series (TMDB API, same polymorphic `items` table).
- Restaurants (manual or Google Places).
- Owner edit UI (rate / add directly from the app).
- Filters: rating slider, player count, weight for BGG.
- Play log (individual timestamps) if/when aggregate `play_count` feels too coarse.
