import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { Home, LogIn, Plus } from "lucide-react";
import { ensureOwnerClaim, getUser, isOwner } from "@/lib/auth";
import { ENABLED_CATEGORIES } from "@/lib/categories";
import { SyncButton } from "@/components/SyncButton";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

/**
 * Force per-request rendering so the sidebar's owner-only buttons
 * always reflect the current session — without this, Next.js caches
 * the layout from the first (logged-out) render and reuses it. Both
 * `dynamic = "force-dynamic"` and `noStore()` are required: the export
 * disables route segment caching, the call disables data-cache memoization
 * of the layout's RSC payload across navigations within the same group.
 */
export const dynamic = "force-dynamic";

/**
 * App-shell layout — sidebar + centered content.
 * Wraps every route except the (landing) homepage.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  noStore();
  const user = await getUser().catch(() => null);
  if (user) await ensureOwnerClaim().catch(() => {});
  const owner = user ? await isOwner().catch(() => false) : false;

  return (
    <div className="flex min-h-screen">
      <Sidebar owner={owner} signedIn={!!user} />
      <main className="flex-1 min-h-screen overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">{children}</div>
      </main>
    </div>
  );
}

function Sidebar({ owner, signedIn }: { owner: boolean; signedIn: boolean }) {
  return (
    // sticky + h-screen so the bottom block (Sincronizar/Adicionar/Sair)
    // stays visible while long category lists scroll. Without this the
    // aside stretches to the page height and the bottom block sits below
    // the viewport on routes like /boardgames.
    <aside className="hidden md:flex sticky top-0 h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-sm">
      <div className="px-6 pt-8 pb-6">
        <Link href="/" className="block leading-tight tracking-tight">
          <span className="block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Elias&apos;s
          </span>
          <span className="block text-lg font-semibold">
            Hobbies DB<span className="text-[var(--accent)]">.</span>
          </span>
        </Link>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        <NavLink href="/" icon={<Home size={16} />} label="Início" />
        {ENABLED_CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <NavLink
              key={c.slug}
              href={`/${c.slug}`}
              icon={<Icon size={16} />}
              label={c.label}
            />
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-3 pb-6">
        {owner && <SyncButton />}
        {owner && <NavLink href="/add" icon={<Plus size={16} />} label="Adicionar" />}
        {!signedIn && <NavLink href="/login" icon={<LogIn size={16} />} label="Entrar" />}
        {signedIn && <SignOutButton />}
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[var(--foreground)]/80",
        "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
