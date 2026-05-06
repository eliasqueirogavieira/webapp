import { CollectionPage } from "@/components/CollectionPage";
import type { CollectionSort } from "@/lib/data";

export const dynamic = "force-dynamic";

const SORTS: CollectionSort[] = ["rating", "acquisition", "title"];

export default async function BoardgamesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const sp = await searchParams;
  const sort: CollectionSort = SORTS.includes(sp.sort as CollectionSort)
    ? (sp.sort as CollectionSort)
    : "rating";
  return <CollectionPage category="boardgame" sort={sort} />;
}
