import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { adaptableCategories, getAdapter } from "@/lib/add-adapters";
import { getCategoryByEnum } from "@/lib/categories";
import { AddForm, type AddTab } from "./AddForm";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  if (!(await isOwner())) {
    redirect("/login");
  }

  const tabs: AddTab[] = adaptableCategories().flatMap((cat) => {
    const adapter = getAdapter(cat);
    if (!adapter) return [];
    const config = getCategoryByEnum(cat);
    return [
      {
        category: cat,
        label: config.label,
        icon: config.icon,
        sourceLabel: adapter.sourceLabel,
      },
    ];
  });

  const sources = tabs.map((t) => t.sourceLabel).join(" ou ");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Adicionar</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pesquise no {sources} e selecione um resultado para adicionar à sua
          coleção.
        </p>
      </header>
      <AddForm tabs={tabs} />
    </div>
  );
}
