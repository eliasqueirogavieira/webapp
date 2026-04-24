import { cn } from "@/lib/utils";

export function BentoTile({
  title,
  subtitle,
  children,
  className,
  span = "md",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  span?: "sm" | "md" | "lg" | "xl";
}) {
  const spanCls =
    span === "sm"
      ? "md:col-span-2"
      : span === "md"
      ? "md:col-span-3"
      : span === "lg"
      ? "md:col-span-4"
      : "md:col-span-6";
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5",
        "col-span-6",
        spanCls,
        className,
      )}
    >
      {title && (
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-[var(--foreground)]">{title}</h2>
          {subtitle && (
            <span className="text-xs text-[var(--muted)]">{subtitle}</span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
