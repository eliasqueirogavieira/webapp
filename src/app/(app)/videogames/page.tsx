import { ItemGrid } from "@/components/ItemGrid";
import { getVideogames } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function VideogamesPage() {
  const items = await getVideogames();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Video games</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {items.length} {items.length === 1 ? "jogo" : "jogos"}
        </p>
      </header>
      <ItemGrid items={items} />
    </div>
  );
}
