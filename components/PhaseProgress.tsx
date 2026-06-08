import { createAdminClient } from "@/lib/supabase/admin";
import type { Phase } from "@/lib/types";

/**
 * Tabla compacta con el estado de cada jugador en la fase activa:
 * cuántos marcadores ha rellenado de los totales, y si ya envió.
 *
 * Privacidad: muestra solo el conteo, NUNCA los marcadores concretos. Eso
 * permite ver el progreso social sin filtrar pronósticos ajenos.
 *
 * Usa el cliente admin (service_role) para poder contar predictions de otros
 * jugadores aunque RLS estuviera más restrictivo en el futuro. Solo se exponen
 * los conteos al cliente.
 */
export default async function PhaseProgress({ phase }: { phase: Phase }) {
  const admin = createAdminClient();

  const [{ data: profiles }, { data: matchesData }, { data: submissions }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, display_name")
        .order("display_name"),
      admin.from("matches").select("id").eq("phase_id", phase.id),
      admin.from("submissions").select("user_id").eq("phase_id", phase.id),
    ]);

  const matchIds = (matchesData ?? []).map((m) => m.id);
  const totalMatches = matchIds.length;
  const submittedSet = new Set((submissions ?? []).map((s) => s.user_id));

  // Conteo de predictions por usuario para esta fase.
  // Postgres no permite groupBy directo desde supabase-js sin RPC, pero sí
  // podemos traer (user_id, match_id) y contar en memoria (5 jugadores, manejable).
  const { data: predRows } = matchIds.length
    ? await admin
        .from("predictions")
        .select("user_id, match_id")
        .in("match_id", matchIds)
    : { data: [] as { user_id: string; match_id: number }[] };

  const filledByUser = new Map<string, number>();
  for (const p of predRows ?? []) {
    filledByUser.set(p.user_id, (filledByUser.get(p.user_id) ?? 0) + 1);
  }

  const rows = (profiles ?? []).map((u) => {
    const filled = filledByUser.get(u.id) ?? 0;
    const sent = submittedSet.has(u.id);
    const pct = totalMatches > 0 ? Math.round((filled / totalMatches) * 100) : 0;
    return { ...u, filled, sent, pct };
  });

  // Ordenar: enviados primero, luego por más rellenos.
  rows.sort((a, b) => {
    if (a.sent !== b.sent) return a.sent ? -1 : 1;
    return b.filled - a.filled;
  });

  return (
    <section className="rounded-xl border bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">📊 Estado de los pronósticos</h2>
        <span className="text-xs text-slate-500">
          {phase.name} · {totalMatches} partidos
        </span>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {r.display_name}
            </span>

            <div className="flex items-center gap-2">
              <span className="hidden tabular-nums text-xs text-slate-500 sm:inline">
                {r.filled}/{totalMatches}
              </span>
              <div
                className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"
                aria-label={`${r.filled} de ${totalMatches} marcadores`}
              >
                <div
                  className={`h-full transition-all ${
                    r.sent ? "bg-green-500" : "bg-pitch"
                  }`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <span className="tabular-nums text-xs text-slate-600 sm:hidden">
                {r.filled}/{totalMatches}
              </span>
              {r.sent ? (
                <span className="flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                  Enviado ✓
                </span>
              ) : r.filled > 0 ? (
                <span className="flex-shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800">
                  Borrador
                </span>
              ) : (
                <span className="flex-shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  Sin empezar
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] text-slate-400">
        Solo se muestra el progreso de cada uno, no los marcadores concretos.
      </p>
    </section>
  );
}
