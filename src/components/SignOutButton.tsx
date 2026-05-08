import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Sidebar logout link. Renders as a styled-form-button so it matches the
 * surrounding NavLink visuals while still going through a real <form> POST
 * to the server action — no client-side JS needed.
 */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--foreground)]/80",
          "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors",
        )}
      >
        <LogOut size={16} />
        Sair
      </button>
    </form>
  );
}
