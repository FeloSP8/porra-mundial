import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Phase, Match } from "@/lib/types";
import PhaseControls from "@/components/admin/PhaseControls";
import ResultEditor from "@/components/admin/ResultEditor";
import RecalcButton from "@/components/admin/RecalcButton";
import UpdateButton from "@/components/admin/UpdateButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  // Usamos el cliente admin para ver TODO sin restricciones de RLS.
  const admin = createAdminClient();
  const { data: phases } = await admin
    .from("phases")
    .select("*")
    .order("order");
  const { data: matches } = await admin
    .from("matches")
    .select("*")
    .order("kickoff", { nullsFirst: false });

  const matchList = (matches ?? []) as Match[];

  // Agrupar partidos por fase para el editor de resultados.
  const byPhase: Record<number, Match[]> = {};
  for (const m of matchList) (byPhase[m.phase_id] ??= []).push(m);

  // Primer kickoff de cada fase (para pre-rellenar el deadline al abrir).
  const firstKickoffByPhase: Record<number, string> = {};
  for (const m of matchList) {
    if (!m.kickoff) continue;
    const prev = firstKickoffByPhase[m.phase_id];
    if (!prev || m.kickoff < prev) firstKickoffByPhase[m.phase_id] = m.kickoff;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Panel de administración</h1>
          <Link href="/" className="text-sm text-pitch hover:underline">
            ← Volver a la app
          </Link>
        </div>

        {/* FASES */}
        <section className="space-y-3">
          <h2 className="font-semibold text-pitch">Fases</h2>
          <p className="text-sm text-slate-600">
            Abre/cierra cada fase y fija su fecha límite. Las fases con deadline
            pasado se cierran solas en la rutina diaria.
          </p>
          <div className="space-y-2">
            {(phases ?? []).map((p: Phase) => (
              <PhaseControls
                key={p.id}
                phase={p}
                firstKickoff={firstKickoffByPhase[p.id]}
              />
            ))}
          </div>
        </section>

        {/* ACTUALIZAR AHORA (proceso completo, como el cron) */}
        <section className="space-y-3">
          <h2 className="font-semibold text-pitch">Actualizar resultados</h2>
          <p className="text-sm text-slate-600">
            Trae los resultados de football-data y recalcula la clasificación
            <b> al instante</b>, sin esperar a la rutina de las 8:00. Úsalo
            cuando ya se hayan jugado partidos.
          </p>
          <UpdateButton />
        </section>

        {/* RECÁLCULO (solo recalcula, sin llamar a football-data) */}
        <section className="space-y-3">
          <h2 className="font-semibold text-pitch">Recálculo</h2>
          <p className="text-sm text-slate-600">
            Solo recalcula los puntos con lo que hay en la BD (tras editar
            resultados a mano o cambiar la puntuación). No llama a football-data.
          </p>
          <RecalcButton />
        </section>

        {/* RESULTADOS A MANO */}
        <section className="space-y-3">
          <h2 className="font-semibold text-pitch">Resultados (entrada manual)</h2>
          <p className="text-sm text-slate-600">
            Fallback por si la API falla. Al guardar un resultado se recalculan
            los puntos al instante.
          </p>

          {matchList.length === 0 ? (
            <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">
              No hay partidos cargados todavía. Ejecuta{" "}
              <code className="rounded bg-slate-100 px-1">npm run load:calendar</code>{" "}
              para traer el calendario del Mundial.
            </div>
          ) : (
            (phases ?? []).map((p: Phase) => {
              const ms = byPhase[p.id] ?? [];
              if (ms.length === 0) return null;
              return (
                <div key={p.id} className="rounded-lg border bg-white p-4">
                  <h3 className="mb-1 font-semibold">{p.name}</h3>
                  {ms.map((m) => (
                    <ResultEditor key={m.id} match={m} />
                  ))}
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
