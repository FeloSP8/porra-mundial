import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalcAll, computeGroupResults, recalcBracket } from "@/lib/recalc";

/**
 * Fuerza un recálculo completo (sin llamar a football-data). Útil tras editar
 * resultados a mano o cambiar los pesos de puntuación en lib/scoring.ts.
 */
export async function POST() {
  const guard = await assertAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: guard.status });
  }
  const admin = createAdminClient();
  const groups = await computeGroupResults(admin);
  const recalc = await recalcAll(admin);
  const bracket = await recalcBracket(admin);
  return NextResponse.json({ ok: true, groups, recalc, bracket });
}
