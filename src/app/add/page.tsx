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
        <h1 className="text-3xl font-semibold tracking-tight">Add new</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Search BGG or IGDB and pick a result to add it to your collection.
        </p>
      </header>
      <AddForm />
    </div>
  );
}
