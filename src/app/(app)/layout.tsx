import Link from "next/link";
import { Dice5, Gamepad2, Home, LogIn, Plus } from "lucide-react";
import { getUser, isOwner } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * App-shell layout — sidebar + centered content.
 * Wraps every route except the (landing) homepage.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser().catch(() => null);
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
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-sm">
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
        <NavLink href="/boardgames" icon={<Dice5 size={16} />} label="Board games" />
        <NavLink href="/videogames" icon={<Gamepad2 size={16} />} label="Video games" />
      </nav>

      <div className="mt-auto flex flex-col gap-1 px-3 pb-6">
        {owner && <NavLink href="/add" icon={<Plus size={16} />} label="Adicionar" />}
        {!signedIn && <NavLink href="/login" icon={<LogIn size={16} />} label="Entrar" />}
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
