import { createClient } from "@/lib/supabase/server";
import { computeStandings } from "@/lib/standings";

/**
 * Tabla de clasificación general (Server Component). Suma de puntos por
 * partidos + orden de grupos + cuadro − penalizaciones.
 *
 * Orden: 1) puntos totales (desc); 2) más marcadores EXACTOS acertados (desc);
 * 3) nombre alfabético. Así, ante un empate a puntos, desempata quien más
 * resultados exactos clavó, y si aún empatan, el orden es estable (alfabético).
 *
 * - currentUserId: para destacar la fila del usuario actual.
 * - compact:       en la home reduce padding y oculta columnas Partidos/Grupos.
 */
export default async function LeaderboardTable({
  currentUserId,
  compact = false,
}: {
  currentUserId: string;
  compact?: boolean;
}) {
  const supabase = createClient();
  const ranking = await computeStandings(supabase);

  const cellPad = compact ? "px-2.5 py-2" : "px-2.5 sm:px-4 py-2.5";

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className={`${cellPad} w-12 text-center`}>#</th>
            <th className={cellPad}>Jugador</th>
            {!compact && (
              <>
                <th className={`${cellPad} text-right`}>Partidos</th>
                <th className={`${cellPad} text-right`}>Grupos</th>
                <th className={`${cellPad} text-right`}>Cuadro</th>
                <th className={`${cellPad} text-right`}>Pen.</th>
              </>
            )}
            <th className={`${cellPad} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((r, i) => {
            const medal =
              i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
            return (
              <tr
                key={r.user_id}
                className={`border-t ${
                  r.user_id === currentUserId ? "bg-yellow-50 font-semibold" : ""
                }`}
              >
                <td className={`${cellPad} text-center`}>{medal}</td>
                <td className={cellPad}>
                  <span
                    className="max-w-[110px] sm:max-w-none truncate inline-block align-bottom"
                    title={r.display_name}
                  >
                    {r.display_name}
                  </span>
                  {r.user_id === currentUserId && (
                    <span className="ml-1 text-xs text-slate-400 align-bottom">
                      (tú)
                    </span>
                  )}
                </td>
                {!compact && (
                  <>
                    <td className={`${cellPad} text-right`}>{r.matchPoints}</td>
                    <td className={`${cellPad} text-right`}>{r.groupPoints}</td>
                    <td className={`${cellPad} text-right`}>{r.bracketPoints}</td>
                    <td
                      className={`${cellPad} text-right ${
                        r.penaltyPoints < 0 ? "text-red-600" : "text-slate-400"
                      }`}
                    >
                      {r.penaltyPoints || 0}
                    </td>
                  </>
                )}
                <td className={`${cellPad} text-right text-lg`}>{r.total}</td>
              </tr>
            );
          })}
          {ranking.length === 0 && (
            <tr>
              <td
                colSpan={compact ? 3 : 7}
                className="px-4 py-6 text-center text-slate-400"
              >
                Aún no hay jugadores.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
