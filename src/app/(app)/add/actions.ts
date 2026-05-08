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
  const itemId = await adapter.import(externalId);
  const slug = getCategoryByEnum(category).slug;
  revalidatePath(`/${slug}`);
  revalidatePath("/");
  redirect(`/${slug}/${itemId}`);
}

export async function updateRating(itemId: string, rating: number | null) {
  if (!(await isOwner())) throw new Error("Unauthorized");
  const supabase = createAdminClient();
  await supabase.from("items").update({ rating }).eq("id", itemId);
  revalidatePath(`/boardgames/${itemId}`);
  revalidatePath(`/videogames/${itemId}`);
  revalidatePath("/");
}
