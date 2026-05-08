import type { CategoryEnum } from "@/lib/categories";

/**
 * Uniform shape for "I searched an external source and got a hit" — what the
 * AddForm renders. Each adapter normalizes its provider's response into this
 * shape so the UI doesn't branch by category.
 */
export type SearchHit = {
  externalId: string;
  title: string;
  year: number | null;
  coverUrl: string | null;
  /** e.g. "boardgame", "Strategy · Sci-Fi", "PS5, PC" — adapter's choice. */
  subtitle?: string;
};

export interface CategoryAdapter {
  category: CategoryEnum;
  /** Shown in the search input placeholder, e.g. "Pesquisar no IGDB...". */
  sourceLabel: string;
  /** Free-form query → list of hits. Adapter handles its own rate limits
   *  and pagination. The action layer only filters out queries < 2 chars. */
  search(query: string): Promise<SearchHit[]>;
  /**
   * External id (BGG objectid, IGDB id, …) → newly-created items.id.
   *
   * Adapter is responsible for the full insert: items row, item_externals
   * row(s), and any category-specific column writes.
   *
   * Idempotent contract: if an item already exists for
   * (item_externals.source = adapter's source, external_id = id), return
   * its existing id without inserting.
   */
  import(externalId: string): Promise<string>;
}
