"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import type {
  BiggestWin,
  MatchConsensus,
  TeamConsensus,
  PlayerGoals,
  Originality,
  ScoreLine,
  TeamResult,
} from "@/lib/predictionStats";

type Stats = {
  phaseName: string;
  submittedCount: number;
  biggestWins: BiggestWin[];
  mostAgreed: MatchConsensus[];
  mostDivided: MatchConsensus[];
  unanimousTeam: TeamConsensus | null;
  dividedTeam: TeamConsensus | null;
  favorite: { team: string; wins: number } | null;
  victim: { team: string; losses: number } | null;
  playerGoals: PlayerGoals[];
  commonScore: { score: ScoreLine; count: number } | null;
  originality: Originality[];
};

const PITCH = "#0b6e4f";
const GOLD = "#f4c430";

/** Verbo del resultado mayoritario de un equipo (para textos). */
function resultVerb(r: TeamResult): string {
  return r === "win" ? "ganador" : r === "loss" ? "eliminado/perdedor" : "empatando";
}

export default function PredictionStatsView({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Qué ha pronosticado la peña en <b>{stats.phaseName}</b> (aún sin jugar),
        sobre los <b>{stats.submittedCount}</b> jugadores que ya han enviado.
      </p>

      {/* Destacados rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.favorite && (
          <Highlight
            emoji="⭐"
            label="Favorito de la peña"
            team={stats.favorite.team}
            sub={`${stats.favorite.wins} victorias`}
          />
        )}
        {stats.victim && (
          <Highlight
            emoji="💀"
            label="La víctima"
            team={stats.victim.team}
            sub={`${stats.victim.losses} derrotas`}
          />
        )}
        {stats.unanimousTeam && (
          <Highlight
            emoji="🤝"
            label="Más unanimidad"
            team={stats.unanimousTeam.team}
            sub={`${Math.round(
              stats.unanimousTeam.agreement * 100
            )}% lo da ${resultVerb(stats.unanimousTeam.topResult)}`}
          />
        )}
        {stats.dividedTeam && (
          <Highlight
            emoji="🔥"
            label="El más polémico"
            team={stats.dividedTeam.team}
            sub={`sin acuerdo: ${stats.dividedTeam.win}G · ${stats.dividedTeam.draw}E · ${stats.dividedTeam.loss}P`}
          />
        )}
      </div>

      {/* Mayores goleadas */}
      <Card title="🥅 Mayores goleadas pronosticadas">
        <ul className="space-y-2">
          {stats.biggestWins.map((b, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Flag team={b.match.home_team} />
                <span className="truncate">{esName(b.match.home_team)}</span>
                <b className="px-1">
                  {b.score.home}-{b.score.away}
                </b>
                <span className="truncate">{esName(b.match.away_team)}</span>
                <Flag team={b.match.away_team} />
              </span>
              <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">
                {b.user}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Marcador más repetido */}
      {stats.commonScore && (
        <Card title="🔢 Marcador más repetido">
          <div className="flex items-center justify-center gap-3 py-2">
            <span className="text-3xl font-extrabold text-pitch">
              {stats.commonScore.score.home}-{stats.commonScore.score.away}
            </span>
            <span className="text-sm text-slate-500">
              elegido {stats.commonScore.count}{" "}
              {stats.commonScore.count === 1 ? "vez" : "veces"}
            </span>
          </div>
        </Card>
      )}

      {/* Partidos más unánimes / divididos */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="🤝 Partidos con más acuerdo">
          <ConsensusList items={stats.mostAgreed} />
        </Card>
        <Card title="⚔️ Partidos con más dudas">
          <ConsensusList items={stats.mostDivided} />
        </Card>
      </div>

      {/* Media de goles por jugador (barras) */}
      <Card title="⚽ Media de goles por partido (por jugador)">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stats.playerGoals.map((p) => ({
                name: p.user,
                goles: Number(p.avgGoals.toFixed(2)),
              }))}
              margin={{ top: 8, right: 8, bottom: 8, left: -20 }}
            >
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${v} goles/partido`, "Media"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="goles" radius={[6, 6, 0, 0]}>
                {stats.playerGoals.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? GOLD : PITCH} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-xs text-slate-400">
          El más goleador en dorado. {stats.playerGoals[0]?.user} es quien más
          goles mete en sus pronósticos.
        </p>
      </Card>

      {/* % de empates por jugador (barras horizontales tipo donut/medidor) */}
      <Card title="🤷 El empatólogo (% de empates pronosticados)">
        <ul className="space-y-2">
          {[...stats.playerGoals]
            .sort((a, b) => b.drawPct - a.drawPct)
            .map((p) => (
              <li key={p.user} className="text-sm">
                <div className="mb-0.5 flex items-center justify-between">
                  <span>{p.user}</span>
                  <span className="tabular-nums text-slate-500">
                    {p.drawPct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-pitch"
                    style={{ width: `${p.drawPct}%` }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </Card>

      {/* Originalidad (qué % coincide con el consenso).
          Solo tiene sentido con 3+ jugadores: con 2 no existe una "mayoría"
          real (en los partidos donde discrepan es 1 vs 1), así que se oculta. */}
      {stats.submittedCount >= 3 && (
      <Card title="🧠 ¿Quién va con la corriente?">
        <p className="mb-2 text-xs text-slate-500">
          % de partidos en que el jugador coincide con el signo mayoritario.
          Bajo = más original; alto = más gregario.
        </p>
        <ul className="space-y-2">
          {stats.originality.map((o, i) => (
            <li key={o.user} className="text-sm">
              <div className="mb-0.5 flex items-center justify-between">
                <span>
                  {o.user}
                  {i === 0 && (
                    <span className="ml-1 text-xs text-purple-600">
                      🦄 el más original
                    </span>
                  )}
                  {i === stats.originality.length - 1 && (
                    <span className="ml-1 text-xs text-slate-400">
                      🐑 el más gregario
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-slate-500">
                  {o.alignmentPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${o.alignmentPct}%`,
                    background: i === 0 ? "#9333ea" : PITCH,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-pitch">{title}</h2>
      {children}
    </section>
  );
}

function Highlight({
  emoji,
  label,
  team,
  sub,
}: {
  emoji: string;
  label: string;
  team: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      <div className="text-2xl">{emoji}</div>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <Flag team={team} />
        <span className="truncate text-sm font-bold">{esName(team)}</span>
      </div>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

/** Texto claro del resultado mayoritario de un partido. */
function consensusLabel(c: MatchConsensus): string {
  if (c.topOutcome === "X") return "empate";
  const winner =
    c.topOutcome === "1" ? c.match.home_team : c.match.away_team;
  return `gana ${esName(winner)}`;
}

function ConsensusList({ items }: { items: MatchConsensus[] }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((c) => {
        const pct = Math.round(c.agreement * 100);
        return (
          <li key={c.match.id}>
            <div className="flex items-center gap-1 min-w-0">
              <Flag team={c.match.home_team} />
              <span className="truncate">{esName(c.match.home_team)}</span>
              <span className="text-slate-300">·</span>
              <span className="truncate">{esName(c.match.away_team)}</span>
              <Flag team={c.match.away_team} />
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              <b className="text-slate-700">{pct}%</b> coincide en que{" "}
              <b className="text-slate-700">{consensusLabel(c)}</b>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
