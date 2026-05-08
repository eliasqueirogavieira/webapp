import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Logout button, rendered as a `<form action={serverAction}>` so it works
 * without client JS. Two visual variants for the two layouts that use it.
 */
export function SignOutButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "topnav";
}) {
  const sidebar = cn(
    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--foreground)]/80",
    "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors",
  );
  const topnav = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-[var(--foreground)]/80",
    "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors",
  );
  return (
    <form action={signOut}>
      <button type="submit" className={variant === "topnav" ? topnav : sidebar}>
        <LogOut size={variant === "topnav" ? 14 : 16} />
        Sair
      </button>
    </form>
  );
}
