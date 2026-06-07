import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMatches, teamName, groupLabelOf } from "@/lib/footballdata";
import { recalcAll, computeGroupResults } from "@/lib/recalc";
import { STAGE_TO_PHASE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rutina diaria. Vercel Cron la llama con el header
 * "Authorization: Bearer <CRON_SECRET>". También se puede disparar a mano
 * desde el panel admin (que reenvía el mismo secret) o con curl para probar.
 *
 * Pasos:
 *  1. Verifica el secret.
 *  2. Trae partidos terminados de football-data.org.
 *  3. Actualiza marcadores en la BD (casa los partidos por external_id).
 *  4. Cierra fases cuyo deadline ya pasó.
 *  5. Calcula clasificación real de grupos completados.
 *  6. Recalcula los puntos de todos los jugadores.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const log: Record<string, unknown> = {};

  // 1) Cerrar fases cuyo deadline ya pasó.
  const nowIso = new Date().toISOString();
  await admin
    .from("phases")
    .update({ is_open: false })
    .lt("deadline", nowIso)
    .eq("is_open", true);

  // 2) Traer resultados de football-data.
  const result = await fetchMatches("FINISHED");
  if (!result.ok) {
    // No abortamos del todo: recalculamos con lo que ya hay en BD
    // (por si el admin metió resultados a mano).
    log.footballDataError = result.error;
  } else {
    // 3) Casar por external_id y actualizar marcadores.
    let updated = 0;
    for (const fm of result.matches) {
      const home = fm.score?.fullTime?.home;
      const away = fm.score?.fullTime?.away;
      if (home === null || away === null) continue;

      const { error, count } = await admin
        .from("matches")
        .update(
          {
            home_score: home,
            away_score: away,
            status: "FINISHED",
            updated_at: new Date().toISOString(),
          },
          { count: "exact" }
        )
        .eq("external_id", fm.id);

      if (!error && (count ?? 0) > 0) updated++;
    }
    log.matchesUpdatedFromApi = updated;
    log.apiFinishedMatches = result.matches.length;
    void teamName;
    void groupLabelOf;
    void STAGE_TO_PHASE;
  }

  // 5) Clasificación real de grupos completados.
  const groups = await computeGroupResults(admin);
  log.groups = groups;

  // 6) Recalcular puntos.
  const recalc = await recalcAll(admin);
  log.recalc = recalc;

  return NextResponse.json({ ok: true, ranAt: nowIso, ...log });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
