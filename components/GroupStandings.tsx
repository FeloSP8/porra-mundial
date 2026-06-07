"use client";

import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import { groupTable, type TableMatch } from "@/lib/groupTable";

/**
 * Tabla de clasificación de un grupo, calculada en vivo a partir de los
 * marcadores pronosticados. Aplica los criterios oficiales de desempate del
 * Mundial 2026 (ver lib/groupTable.ts).
 *
 * Solo cuenta partidos con AMBOS marcadores rellenos; mientras falten, la
 * tabla refleja lo que haya hasta el momento.
 */
export default function GroupStandings({
  label,
  teams,
  matches,
}: {
  label: string;
  teams: string[];
  matches: TableMatch[];
}) {
  const table = groupTable(teams, matches);

  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-sm font-semibold">Grupo {label}</p>
      <table className="w-full text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="w-4 text-left font-medium">#</th>
            <th className="text-left font-medium">Equipo</th>
            <th className="w-6 text-center font-medium" title="Partidos jugados">
              PJ
            </th>
            <th className="w-8 text-center font-medium" title="Diferencia de goles">
              DG
            </th>
            <th className="w-7 text-center font-medium" title="Puntos">
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {table.map((row, idx) => (
            <tr
              key={row.team}
              className={`border-t ${
                idx < 2 ? "bg-green-50" : "" // top 2 clasifican directo
              }`}
            >
              <td className="py-1 text-slate-400">{idx + 1}</td>
              <td className="flex items-center gap-1.5 py-1">
                <Flag team={row.team} />
                <span className="truncate">{esName(row.team)}</span>
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
    </div>
  );
}
