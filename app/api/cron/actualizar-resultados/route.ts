import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recalcAll,
  computeGroupResults,
  recalcBracket,
  autoCloseExpiredPhases,
} from "@/lib/recalc";
import { syncCalendar } from "@/lib/syncCalendar";

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

  // 1b) Auto-cierre con penalización: a quien no envió una fase vencida se le
  //     marca como enviado y se le restan 2 pts por cada partido sin marcador.
  log.autoClose = await autoCloseExpiredPhases(admin);

  // 2) Sincronizar el calendario con football-data: actualiza marcadores Y
  //    CREA los cruces de eliminatoria nuevos a medida que se confirman los
  //    emparejamientos. Idempotente por external_id.
  const sync = await syncCalendar(admin);
  if (sync.error) {
    // No abortamos: recalculamos con lo que ya hay en BD (por si el admin
    // metió resultados a mano).
    log.footballDataError = sync.error;
  } else {
    log.calendar = {
      created: sync.created,
      updated: sync.updated,
      skipped: sync.skipped,
    };
  }

  // 5) Clasificación real de grupos completados.
  const groups = await computeGroupResults(admin);
  log.groups = groups;

  // 6) Recalcular puntos (partidos/grupos + cuadro).
  const recalc = await recalcAll(admin);
  log.recalc = recalc;
  log.bracket = await recalcBracket(admin);

  return NextResponse.json({ ok: true, ranAt: nowIso, ...log });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
