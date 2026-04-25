import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-24">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-[var(--muted)]">Nada aqui.</p>
      <Link href="/" className="text-[var(--accent)] hover:underline">
        Voltar para o início
      </Link>
    </div>
  );
}
