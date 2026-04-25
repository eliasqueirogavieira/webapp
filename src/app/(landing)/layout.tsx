import Link from "next/link";
import { getUser, isOwner } from "@/lib/auth";

/**
 * Landing layout — top nav, no sidebar. Used only on /.
 */
export default async function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser().catch(() => null);
  const owner = user ? await isOwner().catch(() => false) : false;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav owner={owner} signedIn={!!user} />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TopNav({ owner, signedIn }: { owner: boolean; signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/60 bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Link href="/" className="flex items-baseline gap-1.5 leading-none tracking-tight">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Elias&apos;s
          </span>
          <span className="text-lg font-semibold">
            Hobbies DB<span className="text-[var(--accent)]">.</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavBtn href="/boardgames">Board games</NavBtn>
          <NavBtn href="/videogames">Video games</NavBtn>
          {owner && <NavBtn href="/add">Adicionar</NavBtn>}
          {!signedIn && <NavBtn href="/login">Entrar</NavBtn>}
        </nav>
      </div>
    </header>
  );
}

function NavBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-1.5 text-sm text-[var(--foreground)]/80 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
    >
      {children}
    </Link>
  );
}
