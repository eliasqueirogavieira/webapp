import { ItemGrid } from "./ItemGrid";
import { getItemsByCategory } from "@/lib/data";
import { getCategoryByEnum, type CategoryEnum } from "@/lib/categories";

/**
 * Generic list-page renderer. Per-category route files (e.g.
 * `app/(app)/boardgames/page.tsx`) just call `<CollectionPage category="boardgame" />`.
 *
 * Adding a new category to the nav = adding it to CATEGORIES + creating one
 * 3-line route file.
 */
export async function CollectionPage({ category }: { category: CategoryEnum }) {
  const config = getCategoryByEnum(category);
  const items = await getItemsByCategory(category);
  const noun = items.length === 1 ? config.countNoun.singular : config.countNoun.plural;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{config.label}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {items.length} {noun}
        </p>
      </header>
      <ItemGrid items={items} />
    </div>
  );
}
