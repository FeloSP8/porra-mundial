import { createClient } from "@/lib/supabase/server";

/**
 * Tabla de clasificación general (Server Component). Suma de puntos por
 * partidos + por orden de grupos.
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

  const [{ data: profiles }, { data: preds }, { data: gsp }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name"),
      supabase.from("predictions").select("user_id, points_awarded"),
      supabase
        .from("group_standings_predictions")
        .select("user_id, points_awarded"),
    ]);

  type Row = {
    user_id: string;
    display_name: string;
    matchPoints: number;
    groupPoints: number;
    total: number;
  };

  const rows: Record<string, Row> = {};
  for (const p of profiles ?? []) {
    rows[p.id] = {
      user_id: p.id,
      display_name: p.display_name,
      matchPoints: 0,
      groupPoints: 0,
      total: 0,
    };
  }
  for (const p of preds ?? []) {
    if (rows[p.user_id]) rows[p.user_id].matchPoints += p.points_awarded ?? 0;
  }
  for (const g of gsp ?? []) {
    if (rows[g.user_id]) rows[g.user_id].groupPoints += g.points_awarded ?? 0;
  }
  for (const r of Object.values(rows)) r.total = r.matchPoints + r.groupPoints;

  const ranking = Object.values(rows).sort((a, b) => b.total - a.total);

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
                  </>
                )}
                <td className={`${cellPad} text-right text-lg`}>{r.total}</td>
              </tr>
            );
          })}
          {ranking.length === 0 && (
            <tr>
              <td
                colSpan={compact ? 3 : 5}
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
