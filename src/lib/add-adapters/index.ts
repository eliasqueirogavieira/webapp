/**
 * Per-category adapter registry for the in-app `/add` flow.
 *
 * Adding a new category later (books / movies / TV / restaurants):
 *   1. Write `src/lib/add-adapters/<name>.ts` exporting a `CategoryAdapter`
 *      that knows how to (a) search the external source and map results to
 *      `SearchHit` and (b) import a chosen result into Supabase (insert
 *      `items` + `item_externals` + any category-specific columns).
 *   2. Register it in REGISTRY below, keyed by category enum.
 *   3. If the category is hidden today, flip its `enabled: true` in
 *      `src/lib/categories.ts`.
 *
 * No changes to AddForm, server actions, or routes are required.
 */
import type { CategoryAdapter } from "./types";
import type { CategoryEnum } from "@/lib/categories";
import { bggAdapter } from "./bgg";
import { igdbAdapter } from "./igdb";

const REGISTRY: Partial<Record<CategoryEnum, CategoryAdapter>> = {
  boardgame: bggAdapter,
  videogame: igdbAdapter,
  // Future:
  //   movie: tmdbAdapter,
  //   series: tmdbSeriesAdapter,
  //   book: openLibraryAdapter,
};

export function getAdapter(category: CategoryEnum): CategoryAdapter | null {
  return REGISTRY[category] ?? null;
}

/** Categories with a working adapter — used to drive the AddForm tabs. */
export function adaptableCategories(): CategoryEnum[] {
  return Object.keys(REGISTRY) as CategoryEnum[];
}

export type { CategoryAdapter, SearchHit } from "./types";
