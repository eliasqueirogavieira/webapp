import Link from "next/link";
import { CalendarDays, Clock, Trophy, Users } from "lucide-react";
import type { LudopediaPartida } from "@/lib/apis/ludopedia";
import { type PlaySummary } from "@/lib/preview";
import { cn } from "@/lib/utils";

const OWNER_USER_ID = 115441; // oktano on Ludopedia
const OWNER_DISPLAY_NAME = "Elias"; // shown in place of "oktano" wherever the owner appears

export function PlaysSummary({ summary }: { summary: PlaySummary }) {
  const hours = (summary.total_minutes / 60).toFixed(1);
  const winRate =
    summary.total_plays > 0
      ? Math.round((summary.wins / summary.total_plays) * 100)
      : 0;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        icon={<CalendarDays size={14} />}
        label="Partidas"
        value={summary.total_plays.toString()}
        sub={
          summary.played_dates !== summary.total_plays
            ? `em ${summary.played_dates} dias`
            : undefined
        }
      />
      <Stat
        icon={<Clock size={14} />}
        label="Horas"
        value={hours}
        sub={`${summary.total_minutes} min`}
      />
      <Stat
        icon={<Trophy size={14} />}
        label="Vitórias"
        value={`${summary.wins}`}
        sub={`${winRate}%`}
      />
      <Stat
        icon={<Users size={14} />}
        label="Última partida"
        value={summary.last_date ? formatDate(summary.last_date) : "—"}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

export function PlaysList({
  plays,
  showAllHref,
  ownerUserId = OWNER_USER_ID,
}: {
  plays: LudopediaPartida[];
  showAllHref?: string;
  ownerUserId?: number;
}) {
  if (plays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        Nenhuma partida registrada ainda.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {plays.map((p) => (
        <PlayRow key={p.id_partida} play={p} ownerUserId={ownerUserId} />
      ))}
      {showAllHref && (
        <Link
          href={showAllHref}
          className="mt-1 inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
        >
          Ver todas as partidas →
        </Link>
      )}
    </div>
  );
}

export function PlayRow({
  play,
  ownerUserId,
}: {
  play: LudopediaPartida;
  ownerUserId: number;
}) {
  const me = play.jogadores.find((j) => j.id_usuario === ownerUserId);
  const won = me?.fl_vencedor === 1;
  const sortedPlayers = [...play.jogadores].sort(
    (a, b) => (b.vl_pontos ?? -Infinity) - (a.vl_pontos ?? -Infinity),
  );
  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--surface)] p-3",
        won
          ? "border-emerald-500/30"
          : me
          ? "border-[var(--border)]"
          : "border-[var(--border)]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-sm tabular-nums">
            {formatDate(play.dt_partida)}
          </div>
          {won && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
              <Trophy size={11} /> Vitória
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          {play.duracao && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {play.duracao} min
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users size={11} /> {play.jogadores.length}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {sortedPlayers.map((j) => (
          <span
            key={j.id_partida_jogador ?? j.nome}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 ring-1",
              j.fl_vencedor === 1
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : "bg-[var(--surface-hover)] text-[var(--foreground)]/80 ring-[var(--border)]",
            )}
          >
            <span className="font-medium">
              {j.id_usuario === ownerUserId ? OWNER_DISPLAY_NAME : j.nome}
            </span>
            {j.vl_pontos !== null && (
              <span className="font-mono tabular-nums text-[var(--muted)]">
                {j.vl_pontos}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  // YYYY-MM-DD → DD <mês> YYYY (UTC-safe — split, don't parse local)
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}
