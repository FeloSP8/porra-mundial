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
  PlayerAccuracy,
  LoneHit,
  GroupMastery,
  BracketLeader,
} from "@/lib/resultStats";

type Stats = {
  finishedCount: number;
  players: PlayerAccuracy[];
  exactKing: PlayerAccuracy | null;
  bestNose: PlayerAccuracy | null;
  seer: { user: string; userId: string; count: number } | null;
  topGroupMaster: GroupMastery | null;
  loneHits: LoneHit[];
  groupMasters: GroupMastery[];
  bracketLeaders: BracketLeader[];
};

const PITCH = "#0b6e4f";
const GOLD = "#f4c430";

export default function StatsView({ stats }: { stats: Stats }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Calculado sobre los <b>{stats.finishedCount}</b> partidos ya jugados.
      </p>

      {/* Destacados */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.exactKing && (
          <Highlight
            emoji="🎯"
            label="Rey del marcador exacto"
            name={stats.exactKing.user}
            sub={`${stats.exactKing.exact} marcador${
              stats.exactKing.exact === 1 ? "" : "es"
            } exacto${stats.exactKing.exact === 1 ? "" : "s"}`}
          />
        )}
        {stats.bestNose && (
          <Highlight
            emoji="🧠"
            label="Mejor olfato (1·X·2)"
            name={stats.bestNose.user}
            sub={`${pct(stats.bestNose.accuracy)} de signos`}
          />
        )}
        {stats.seer && (
          <Highlight
            emoji="🔮"
            label="El vidente"
            name={stats.seer.user}
            sub={`${stats.seer.count} acierto${
              stats.seer.count === 1 ? "" : "s"
            } en solitario`}
          />
        )}
        {stats.topGroupMaster && (
          <Highlight
            emoji="🏆"
            label="Maestro de los grupos"
            name={stats.topGroupMaster.user}
            sub={`${stats.topGroupMaster.correct} posiciones${
              stats.topGroupMaster.perfectGroups > 0
                ? ` · ${stats.topGroupMaster.perfectGroups} grupo${
                    stats.topGroupMaster.perfectGroups === 1 ? "" : "s"
                  } perfecto${stats.topGroupMaster.perfectGroups === 1 ? "" : "s"}`
                : ""
            }`}
          />
        )}
      </div>

      {/* Tabla de precisión */}
      <Card title="📊 Tabla de aciertos">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Jugador</th>
                <th className="py-1.5 px-2 text-right" title="Marcadores exactos">
                  🎯
                </th>
                <th className="py-1.5 px-2 text-right" title="Signos acertados">
                  1·X·2
                </th>
                <th className="py-1.5 px-2 text-right" title="Precisión de signo">
                  %
                </th>
                <th className="py-1.5 pl-2 text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {stats.players.map((p, i) => (
                <tr key={p.userId} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 tabular-nums text-slate-400">
                    {medal(i)}
                  </td>
                  <td className="py-1.5 pr-2 font-medium">{p.user}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    {p.exact}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    {p.outcomes}/{p.predicted}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-slate-500">
                    {pct(p.accuracy)}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">
                    {p.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Puntos por jugador (barras) */}
      {stats.players.length > 0 && (
        <Card title="📈 Puntos de partidos por jugador">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.players.map((p) => ({
                  name: p.user,
                  puntos: p.points,
                }))}
                margin={{ top: 8, right: 8, bottom: 8, left: -20 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [`${v} pts`, "Partidos"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="puntos" radius={[6, 6, 0, 0]}>
                  {stats.players.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? GOLD : PITCH} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Aciertos en solitario */}
      {stats.loneHits.length > 0 && (
        <Card title="🔮 Lo vieron cuando nadie más lo vio">
          <p className="mb-2 text-xs text-slate-500">
            Partidos donde solo un jugador acertó el resultado y todos los demás
            fallaron.
          </p>
          <ul className="space-y-2.5">
            {stats.loneHits.map((h, i) => (
              <li key={i} className="text-sm">
                <div className="flex items-center gap-1 min-w-0">
                  <Flag team={h.match.home_team} />
                  <span className="truncate">{esName(h.match.home_team)}</span>
                  <b className="px-1 tabular-nums">
                    {h.match.home_score}-{h.match.away_score}
                  </b>
                  <span className="truncate">{esName(h.match.away_team)}</span>
                  <Flag team={h.match.away_team} />
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  <b className="text-pitch">{h.user}</b> fue el único que lo
                  acertó{" "}
                  {h.exact ? (
                    <span className="text-amber-600">
                      (¡marcador exacto {h.pred.home}-{h.pred.away}!)
                    </span>
                  ) : (
                    <>frente a {h.missed} que fallaron</>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Maestría en grupos */}
      {stats.groupMasters.length > 0 && (
        <Card title="🏆 Quién adivinó mejor los grupos">
          <p className="mb-2 text-xs text-slate-500">
            Posiciones acertadas en la clasificación final de los grupos.
          </p>
          <ul className="space-y-2">
            {stats.groupMasters.map((g, i) => {
              const max = stats.groupMasters[0]?.correct || 1;
              return (
                <li key={g.userId} className="text-sm">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span>
                      {medal(i)} {g.user}
                      {g.perfectGroups > 0 && (
                        <span className="ml-1 text-xs text-amber-600">
                          · {g.perfectGroups} pleno
                          {g.perfectGroups === 1 ? "" : "s"} 🎯
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums text-slate-500">
                      {g.correct}/{g.total}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(g.correct / max) * 100}%`,
                        background: i === 0 ? GOLD : PITCH,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Cuadro: quién acertó los que avanzan */}
      {stats.bracketLeaders.length > 0 && (
        <Card title="🥇 El cuadro: quién acierta a los que avanzan">
          <ul className="space-y-2">
            {stats.bracketLeaders.map((b, i) => (
              <li
                key={b.userId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">
                  {medal(i)} {b.user}
                  {b.championHit && (
                    <span className="ml-1 text-xs text-amber-600">
                      👑 campeón
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-slate-500">
                  {b.points} acierto{b.points === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Medalla para las 3 primeras posiciones, número para el resto. */
function medal(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? String(i + 1);
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
  name,
  sub,
}: {
  emoji: string;
  label: string;
  name: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      <div className="text-2xl">{emoji}</div>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold">{name}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}
