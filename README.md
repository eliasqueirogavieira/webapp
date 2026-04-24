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

## Project layout

```
src/
  app/              App Router pages
    page.tsx        Homepage (bento)
    boardgames/     List + detail
    videogames/     List + detail
    add/            (auth) search BGG/IGDB and add
    login/          Google OAuth + magic link
    auth/callback/  OAuth return handler
  components/       RatingBadge, ItemCard, ItemGrid, BentoTile
  lib/
    supabase/       SSR + browser + admin clients
    apis/           BGG, IGDB wrappers
    ratings.ts      Rating scale conversions
    auth.ts         Owner check
scripts/
  import-bgg.ts     BGG CSV importer
  import-grouvee.ts Grouvee CSV importer
supabase/
  migrations/       Schema + RLS policies
data/               Your CSV exports (gitignored)
```

## Future

- Movies + series (TMDB API, same polymorphic `items` table).
- Restaurants (manual or Google Places).
- Ludopedia integration for Brazilian editions / pricing.
- Filters: rating slider, player count, weight for BGG.
- Play log (individual timestamps) if/when aggregate `play_count` feels too coarse.
