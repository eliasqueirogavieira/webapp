"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import type { CollectionSort } from "@/lib/data";

const OPTIONS: Array<{ value: CollectionSort; label: string }> = [
  { value: "rating", label: "Mais bem avaliados" },
  { value: "acquisition", label: "Adquiridos recentemente" },
  { value: "title", label: "Título (A–Z)" },
];

export function CollectionSortControl({ value }: { value: CollectionSort }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const onChange = (next: CollectionSort) => {
    const sp = new URLSearchParams(params);
    if (next === "rating") sp.delete("sort");
    else sp.set("sort", next);
    const query = sp.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
      Ordenar por
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CollectionSort)}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none transition-colors hover:border-[var(--foreground)]/30 focus:border-[var(--foreground)]/40"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
