-- Elias's Hobbies DB — initial schema.
--
-- Polymorphic items table (board games + video games today; movies/series/etc.
-- slot in by adding to the enum). Sparse columns hold category-specific fields.
-- Plays are a child table (used by board games for now).
-- RLS: public read across all content; only the owner (registered in
-- owner_config) can write.

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

create type item_category as enum (
  'boardgame',
  'videogame',
  'movie',
  'series',
  'restaurant'
);

create type item_status as enum (
  'owned',
  'played',
  'wishlist',
  'backlog',
  'abandoned',
  'favorite'
);

create table items (
  id                uuid primary key default gen_random_uuid(),
  category          item_category not null,
  title             text not null,
  original_title    text,
  year              int,
  cover_url         text,
  rating            numeric(3,1) check (rating is null or (rating >= 0 and rating <= 10)),
  play_count        int not null default 0,
  status            item_status,
  comment           text,
  -- shared metadata
  min_players       int,
  max_players       int,
  playing_time_min  int,
  age_min           int,
  -- credits / tags
  designers         text[] not null default '{}',
  artists           text[] not null default '{}',
  themes            text[] not null default '{}',
  mechanics         text[] not null default '{}',
  -- video game specific
  platforms         text[] not null default '{}',
  genres            text[] not null default '{}',
  developers        text[] not null default '{}',
  publishers        text[] not null default '{}',
  franchises        text[] not null default '{}',
  release_date      date,
  -- board game specific
  cost              numeric(10,2),
  -- bookkeeping
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index items_category_rating_idx on items (category, rating desc nulls last);
create index items_created_idx on items (created_at desc);
create index items_title_trgm on items using gin (title gin_trgm_ops);

-- External system references (Ludopedia, IGDB, Grouvee, BGG)
create table item_externals (
  item_id     uuid not null references items(id) on delete cascade,
  source      text not null,
  external_id text not null,
  url         text,
  primary key (item_id, source),
  unique (source, external_id)
);

create index item_externals_item_idx on item_externals (item_id);

-- Plays (Ludopedia /partidas — one row per logged match)
create table plays (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references items(id) on delete cascade,
  source        text not null,            -- 'ludopedia' | 'manual'
  external_id   text,                     -- ludopedia id_partida; null for manual
  played_on     date not null,
  duration_min  int,
  description   text,
  bundled_count int not null default 1,   -- ludopedia's qt_partidas (groups same-day plays)
  created_at    timestamptz not null default now(),
  unique (source, external_id)
);

create index plays_item_played_idx on plays (item_id, played_on desc);

-- Players in each play
create table play_participants (
  id                  uuid primary key default gen_random_uuid(),
  play_id             uuid not null references plays(id) on delete cascade,
  name                text not null,
  ludopedia_user_id   bigint,
  score               int,
  winner              boolean not null default false,
  observation         text
);

create index play_participants_play_idx on play_participants (play_id);

-- Owner config: row count = 1, holds the user_id allowed to write.
create table owner_config (
  user_id uuid primary key
);

create or replace function is_owner() returns boolean
language sql stable security definer as $$
  select exists (select 1 from owner_config where user_id = auth.uid());
$$;

-- updated_at trigger on items
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();

-- RLS
alter table items enable row level security;
alter table item_externals enable row level security;
alter table plays enable row level security;
alter table play_participants enable row level security;
alter table owner_config enable row level security;

-- public read everywhere
create policy items_public_read on items
  for select using (true);
create policy item_externals_public_read on item_externals
  for select using (true);
create policy plays_public_read on plays
  for select using (true);
create policy play_participants_public_read on play_participants
  for select using (true);

-- owner-only writes
create policy items_owner_write on items
  for all using (is_owner()) with check (is_owner());
create policy item_externals_owner_write on item_externals
  for all using (is_owner()) with check (is_owner());
create policy plays_owner_write on plays
  for all using (is_owner()) with check (is_owner());
create policy play_participants_owner_write on play_participants
  for all using (is_owner()) with check (is_owner());

-- owner_config: only the owner can read their own row
create policy owner_config_self_read on owner_config
  for select using (user_id = auth.uid());
