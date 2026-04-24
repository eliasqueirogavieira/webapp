-- Personal Collection Tracker — initial schema
-- Polymorphic items table + per-category detail tables.
-- RLS: public read everywhere, writes gated to the owner user id.

create extension if not exists "pgcrypto";

create type media_category as enum (
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
  'abandoned'
);

create table items (
  id             uuid primary key default gen_random_uuid(),
  category       media_category not null,
  title          text not null,
  original_title text,
  year           int,
  cover_url      text,
  rating         numeric(3,1) check (rating is null or (rating >= 0 and rating <= 10)),
  play_count     int not null default 0,
  status         item_status,
  first_played   date,
  last_played    date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index items_category_rating_idx on items (category, rating desc nulls last);
create index items_created_idx on items (created_at desc);
create index items_title_trgm on items using gin (title gin_trgm_ops);
-- pg_trgm requires the extension
create extension if not exists pg_trgm;

create table item_externals (
  item_id     uuid not null references items(id) on delete cascade,
  source      text not null,
  external_id text not null,
  url         text,
  primary key (item_id, source),
  unique (source, external_id)
);

create table item_metadata (
  item_id    uuid primary key references items(id) on delete cascade,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);

create table boardgame_details (
  item_id          uuid primary key references items(id) on delete cascade,
  min_players      int,
  max_players      int,
  playing_time_min int,
  weight           numeric(4,2),
  bgg_rank         int,
  mechanics        text[],
  categories       text[],
  best_players     int[]
);

create table videogame_details (
  item_id      uuid primary key references items(id) on delete cascade,
  platforms    text[],
  genres       text[],
  developers   text[],
  publishers   text[],
  release_date date,
  franchises   text[]
);

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();

-- Owner check: the owner's Supabase user id is stored in a tiny config table.
-- Set it once after signup: `insert into owner_config(user_id) values ('<your-uuid>');`
create table owner_config (
  user_id uuid primary key
);

create or replace function is_owner() returns boolean
language sql stable security definer as $$
  select exists (select 1 from owner_config where user_id = auth.uid());
$$;

-- Row Level Security
alter table items enable row level security;
alter table item_externals enable row level security;
alter table item_metadata enable row level security;
alter table boardgame_details enable row level security;
alter table videogame_details enable row level security;
alter table owner_config enable row level security;

-- Public read on content tables
create policy items_public_read on items for select using (true);
create policy item_externals_public_read on item_externals for select using (true);
create policy item_metadata_public_read on item_metadata for select using (true);
create policy boardgame_details_public_read on boardgame_details for select using (true);
create policy videogame_details_public_read on videogame_details for select using (true);

-- Owner-only writes
create policy items_owner_write on items for all
  using (is_owner()) with check (is_owner());
create policy item_externals_owner_write on item_externals for all
  using (is_owner()) with check (is_owner());
create policy item_metadata_owner_write on item_metadata for all
  using (is_owner()) with check (is_owner());
create policy boardgame_details_owner_write on boardgame_details for all
  using (is_owner()) with check (is_owner());
create policy videogame_details_owner_write on videogame_details for all
  using (is_owner()) with check (is_owner());

-- owner_config: only the owner can read its own row; writes must go through service role
create policy owner_config_self_read on owner_config for select
  using (user_id = auth.uid());
