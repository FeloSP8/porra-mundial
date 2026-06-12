import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFullUpdate } from "@/lib/recalc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fuerza AHORA el mismo proceso completo que la rutina diaria: trae resultados
 * de football-data, actualiza marcadores, calcula clasificación y recalcula
 * puntos. Útil para no esperar al cron de las 8:00 cuando ya hay resultados.
 */
export async function POST() {
  const guard = await assertAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: guard.status });
  }
  const admin = createAdminClient();
  const log = await runFullUpdate(admin);
  return NextResponse.json({ ok: true, ...log });
}
