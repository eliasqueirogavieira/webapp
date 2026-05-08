"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/auth";
import { getAdapter, type SearchHit } from "@/lib/add-adapters";
import { getCategoryByEnum, type CategoryEnum } from "@/lib/categories";

/**
 * Run the configured adapter's search for the given category. Returns an
 * empty list for short queries instead of erroring so the UI's "type to
 * search" affordance feels right.
 */
export async function searchForCategory(
  category: CategoryEnum,
  query: string,
): Promise<SearchHit[]> {
  if (!(await isOwner())) throw new Error("Unauthorized");
  if (query.trim().length < 2) return [];
  const adapter = getAdapter(category);
  if (!adapter) throw new Error(`No add-adapter registered for ${category}`);
  return adapter.search(query);
}

/**
 * Import an item via the registered adapter and bounce to its detail page.
 * Idempotent: if the (source, external_id) already exists, the adapter
 * returns the existing item id and we redirect there.
 */
export async function addItemFromAdapter(
  category: CategoryEnum,
  externalId: string,
): Promise<void> {
  if (!(await isOwner())) throw new Error("Unauthorized");
  const adapter = getAdapter(category);
  if (!adapter) throw new Error(`No add-adapter registered for ${category}`);
  // The adapter does the import; we only need the externalId for the slug.
  await adapter.import(externalId);
  const categorySlug = getCategoryByEnum(category).slug;
  // Detail page (`/<categorySlug>/[id]`) resolves the slug via
  // item_externals — must be `${source}-<externalId>`, NOT the items.id UUID.
  const itemSlug = `${adapter.slugPrefix ?? adapter.source}-${externalId}`;
  revalidatePath(`/${categorySlug}`);
  revalidatePath("/");
  redirect(`/${categorySlug}/${itemSlug}`);
}

export async function updateRating(itemId: string, rating: number | null) {
  if (!(await isOwner())) throw new Error("Unauthorized");
  const supabase = createAdminClient();
  await supabase.from("items").update({ rating }).eq("id", itemId);
  // Use layout-level revalidation so detail + listing + landing all refresh
  // (the detail route is `/<slug>/[id]` keyed by external slug, not UUID).
  revalidatePath("/", "layout");
}

export async function updateStatus(
  itemId: string,
  statuses: string[] | null,
) {
  if (!(await isOwner())) throw new Error("Unauthorized");
  const supabase = createAdminClient();
  // Empty array → null so we don't carry a `{}` row.
  const value = statuses && statuses.length ? statuses : null;
  await supabase.from("items").update({ status: value }).eq("id", itemId);
  revalidatePath("/", "layout");
}
