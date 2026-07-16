import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFullUpdateLogged } from "@/lib/recalc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fuerza AHORA el mismo proceso completo que la rutina diaria: trae resultados
 * de football-data, actualiza marcadores, calcula clasificación y recalcula
 * puntos. Útil para no esperar al cron de las 8:00 cuando ya hay resultados.
 * Queda registrado en `cron_runs` (source = 'admin').
 */
export async function POST() {
  const guard = await assertAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: guard.status });
  }
  const admin = createAdminClient();
  const { log, ok, error } = await runFullUpdateLogged(admin, "admin");
  if (!ok) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...log });
}
