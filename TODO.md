# TODO

Things that aren't blocking the app today but should be revisited.

## Board game acquisition date (still no signal)

The home page works around this by showing "Mais jogados" instead of
"Adicionados recentemente" for board games, but the underlying problem
remains: there's no per-game date on Ludopedia. Sources that could fix it:

- **Ludopedia /colecao**: their web UI shows games in inclusion order
  (`Ordem: Inclusão`), but the public API response on `/api/v1/colecao` does
  not expose any `dt_inclusao` / `data_adicao` / similar field. Confirmed by
  direct inspection of the JSON shape. If they add it, swap in here.
- **BGG XML API2**: the `/collection?username=` endpoint returns a per-row
  `acquisitiondate`. Currently blocked: BGG requires a registered application
  token (Bearer auth). Application is **submitted, awaiting approval** — process
  takes up to a week per their docs. Once the token lands, set
  `BGG_AUTH_TOKEN` in `.env.local`, fetch the collection, and use
  `acquisitiondate` to populate `items.created_at` for every board game. The
  daily sync workflow can be extended to fold this in.

**Workaround until then (optional)**: use `min(played_on)` per game from the
`plays` table as a "first played" proxy. Only covers games actually played
through Ludopedia (~37 of 82 today), the rest stay default. Trade-off:
"first played" ≠ "first owned" but better than no order.

## Other deferred items

- Movies + series category (TMDB API). Schema enum already includes them.
- Restaurants category (manual entry or Google Places). Schema enum included.
- Owner edit UI (rate / add directly from the app instead of seeding from
  Grouvee CSV; only the read path + "Adicionar" search exist today).
- Move video games off the Grouvee CSV: the app becomes the source of truth
  once edit UI exists.
