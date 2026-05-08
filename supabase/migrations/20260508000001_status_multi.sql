-- Switch items.status from a single enum value to a text[] array so a
-- single item can carry multiple states at once (e.g. a video game can
-- be both 'owned' and 'played', or a board game both 'owned' and
-- 'wishlist' if you bought it but want a deluxe edition too).
--
-- The item_status enum stays defined but unused; safe to drop in a later
-- migration once we're confident nothing references it.
--
-- Apply via Supabase Dashboard → SQL Editor → run.

-- 1) Drop the partial index that references status before changing the
--    column type. Postgres re-validates partial-index predicates against
--    the new type otherwise, which fails because there's no
--    `text[] = text` operator.
drop index if exists items_wishlist_idx;

-- 2) Convert items.status from item_status enum → text[]. Existing
--    single values become single-element arrays; nulls stay null.
alter table items
  alter column status drop default,
  alter column status type text[] using
    case when status is null then null else array[status::text] end;

-- 3) Recreate the wishlist index against the new array type.
create index items_wishlist_idx
  on items (wishlist_priority, year)
  where status @> array['wishlist'];
