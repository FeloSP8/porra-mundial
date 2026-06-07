import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

type Row = {
  user_id: string;
  display_name: string;
  matchPoints: number;
  groupPoints: number;
  total: number;
};

export default async function ClasificacionPage() {
  const me = await requireProfile();
  const supabase = createClient();

  const [{ data: profiles }, { data: preds }, { data: gsp }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name"),
      supabase.from("predictions").select("user_id, points_awarded"),
      supabase
        .from("group_standings_predictions")
        .select("user_id, points_awarded"),
    ]);

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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🏆 Clasificación general</h1>
      <p className="text-slate-600">
        Puntos acumulados de todos los jugadores. Se actualiza cada mañana tras
        comprobar los resultados.
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Jugador</th>
              <th className="px-4 py-2 text-right">Partidos</th>
              <th className="px-4 py-2 text-right">Grupos</th>
              <th className="px-4 py-2 text-right">Total</th>
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
                    r.user_id === me.id ? "bg-yellow-50 font-semibold" : ""
                  }`}
                >
                  <td className="px-4 py-2">{medal}</td>
                  <td className="px-4 py-2">
                    {r.display_name}
                    {r.user_id === me.id && (
                      <span className="ml-1 text-xs text-slate-400">(tú)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{r.matchPoints}</td>
                  <td className="px-4 py-2 text-right">{r.groupPoints}</td>
                  <td className="px-4 py-2 text-right text-lg">{r.total}</td>
                </tr>
              );
            })}
            {ranking.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Aún no hay jugadores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
