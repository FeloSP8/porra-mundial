"use client";

import { useState } from "react";
import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";

export type PlayerSlim = { id: string; display_name: string };

export type GroupBlock = {
  label: string;
  table: { team: string; played: number; gd: number; points: number }[];
  groupComplete: boolean;
  predictions: {
    userId: string;
    name: string;
    ordered: string[]; // equipos en el orden 1º..4º que predijo
    provisional: number; // puntos de grupo provisionales
  }[];
};

export default function GroupsView({
  blocks,
  currentUserId,
}: {
  blocks: GroupBlock[];
  currentUserId: string;
}) {
  const [active, setActive] = useState<string>(blocks[0]?.label ?? "A");

  if (blocks.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 text-slate-600">
        Aún no hay grupos cargados.
      </div>
    );
  }

  const block = blocks.find((b) => b.label === active) ?? blocks[0];

  return (
    <div className="space-y-4">
      {/* Selector de grupos: móvil scroll horizontal, escritorio wrap */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none sm:flex-wrap sm:overflow-x-visible sm:mx-0 sm:px-0">
          {blocks.map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setActive(b.label)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                b.label === active
                  ? "bg-pitch text-white border-pitch shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Grupo {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clasificación REAL actual del grupo */}
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-pitch">
            Grupo {block.label} — clasificación actual
          </h2>
          <span className="text-[11px] text-slate-400">
            {block.groupComplete ? "Final" : "En juego"}
          </span>
        </div>
        <table className="w-full text-xs table-fixed">
          <thead className="text-slate-500">
            <tr>
              <th className="w-6 text-left font-medium">#</th>
              <th className="text-left font-medium">Equipo</th>
              <th className="w-8 text-center font-medium" title="Partidos jugados">
                PJ
              </th>
              <th className="w-8 text-center font-medium" title="Diferencia de goles">
                DG
              </th>
              <th className="w-9 text-center font-medium" title="Puntos">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {block.table.map((row, idx) => (
              <tr
                key={row.team}
                className={`border-t ${idx < 2 ? "bg-green-50" : ""}`}
              >
                <td className="py-1 text-slate-400">{idx + 1}</td>
                <td className="py-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Flag team={row.team} className="flex-shrink-0" />
                    <span className="truncate" title={esName(row.team)}>
                      {esName(row.team)}
                    </span>
                  </div>
                </td>
                <td className="text-center">{row.played}</td>
                <td className="text-center">
                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                </td>
                <td className="text-center font-semibold">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Predicciones de cada jugador + puntos provisionales */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-pitch">
          Lo que predijo cada uno
        </h2>
        <p className="text-[11px] text-slate-400">
          Puntos provisionales: 1 por equipo bien colocado respecto a la
          clasificación actual. {block.groupComplete ? "" : "(El grupo aún no ha terminado.)"}
        </p>
        {block.predictions.map((p) => {
          const isMe = p.userId === currentUserId;
          return (
            <div
              key={p.userId}
              className={`rounded-xl border bg-white p-3 ${
                isMe ? "border-pitch/40" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {p.name}
                  {isMe && (
                    <span className="ml-1 text-xs text-slate-400">(tú)</span>
                  )}
                </span>
                <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  +{p.provisional} pts
                </span>
              </div>
              <ol className="space-y-1">
                {p.ordered.map((team, i) => {
                  // ¿bien colocado AHORA? su posición predicha (i) coincide con la real
                  const realIdx = block.table.findIndex((r) => r.team === team);
                  const hit = realIdx === i;
                  const anyPlayed = block.table.some((r) => r.played > 0);
                  return (
                    <li key={team} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-xs text-slate-400">{i + 1}º</span>
                      <Flag team={team} className="flex-shrink-0" />
                      <span className="truncate">{esName(team)}</span>
                      {anyPlayed && (
                        <span
                          className={`ml-auto text-xs ${
                            hit ? "text-green-600" : "text-slate-300"
                          }`}
                          title={
                            hit
                              ? "Bien colocado ahora mismo"
                              : "No coincide con la posición actual"
                          }
                        >
                          {hit ? "✓" : "·"}
                        </span>
                      )}
                    </li>
                  );
                })}
                {p.ordered.length === 0 && (
                  <li className="text-xs text-slate-400">Sin predicción.</li>
                )}
              </ol>
            </div>
          );
        })}
      </section>
    </div>
  );
}
