-- BGG enrichment: acquisition date, wishlist priority, complexity, BGG rank,
-- prev-owned flag, and a per-source modified-at timestamp for incremental syncs.
--
-- Acquisition date and wishlist priority come from BGG's collection endpoint
-- (xmlapi2). Acquisition date specifically requires a logged-in session cookie
-- (the bearer "application token" alone does not expose <privateinfo>); see
-- src/lib/apis/bgg.ts → bggLogin().

alter table items add column acquisition_date   date;
alter table items add column wishlist_priority  smallint
  check (wishlist_priority is null or wishlist_priority between 1 and 5);
alter table items add column weight             numeric(3,2);  -- BGG complexity 1.00–5.00
alter table items add column bgg_rank           int;
alter table items add column was_owned          boolean not null default false;  -- BGG prevowned
alter table items add column source_modified_at timestamptz;  -- BGG <status lastmodified>

create index items_acquisition_idx on items (acquisition_date desc nulls last);

create index items_wishlist_idx on items (wishlist_priority, year)
  where status = 'wishlist';
