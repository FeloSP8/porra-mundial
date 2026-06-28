import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Elimina los envíos y penalizaciones de una fase para que los jugadores
 * puedan volver a enviar sus pronósticos.
 * Útil cuando autoCloseExpiredPhases marcó la fase como cerrada antes de
 * que los jugadores pudieran enviar (deadline incorrecto del seed).
 *
 * Body: { phaseId: number }
 */
export async function POST(request: Request) {
  const guard = await assertAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: guard.status });
  }

  const { phaseId } = await request.json();
  if (typeof phaseId !== "number") {
    return NextResponse.json({ error: "phaseId requerido" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { error: subErr, count: subCount } = await admin
    .from("submissions")
    .delete({ count: "exact" })
    .eq("phase_id", phaseId);
  if (subErr) {
    return NextResponse.json({ error: subErr.message }, { status: 500 });
  }

  const { error: penErr, count: penCount } = await admin
    .from("phase_penalties")
    .delete({ count: "exact" })
    .eq("phase_id", phaseId);
  if (penErr) {
    return NextResponse.json({ error: penErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submissionsDeleted: subCount, penaltiesDeleted: penCount });
}
