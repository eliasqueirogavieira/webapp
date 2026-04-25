import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-semibold tracking-tight">404</h1>
        <p className="text-[var(--muted)]">Nada aqui.</p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--accent-fg)] hover:opacity-90"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
