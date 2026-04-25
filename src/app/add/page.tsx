import { redirect } from "next/navigation";
import { isOwner } from "@/lib/auth";
import { AddForm } from "./AddForm";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  if (!(await isOwner())) {
    redirect("/login");
  }
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Adicionar</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pesquise no BGG ou IGDB e selecione um resultado para adicionar à sua coleção.
        </p>
      </header>
      <AddForm />
    </div>
  );
}
