import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalcAll, computeGroupResults } from "@/lib/recalc";

/**
 * Introduce/edita el resultado de un partido a mano (fallback si la API falla)
 * y recalcula. Body: { matchId, homeScore, awayScore } o
 * { matchId, clear: true } para volver a marcarlo como SCHEDULED.
 */
export async function POST(request: Request) {
  const guard = await assertAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: guard.status });
  }

  const { matchId, homeScore, awayScore, clear, winner: winnerInput } =
    await request.json();
  if (typeof matchId !== "number") {
    return NextResponse.json({ error: "matchId requerido" }, { status: 400 });
  }
  if (
    winnerInput !== undefined &&
    winnerInput !== "HOME_TEAM" &&
    winnerInput !== "AWAY_TEAM"
  ) {
    return NextResponse.json({ error: "winner inválido" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (clear) {
    await admin
      .from("matches")
      .update({
        home_score: null,
        away_score: null,
        winner: null,
        status: "SCHEDULED",
      })
      .eq("id", matchId);
  } else {
    const h = Number(homeScore);
    const a = Number(awayScore);
    if (
      !Number.isInteger(h) ||
      !Number.isInteger(a) ||
      h < 0 ||
      a < 0 ||
      h > 99 ||
      a > 99
    ) {
      return NextResponse.json(
        { error: "Marcador inválido (enteros 0-99)" },
        { status: 400 }
      );
    }
    // El marcador manual se interpreta como el resultado a los 90'. Si es
    // decisivo, `winner` sale del propio marcador. Si es empate (cruce a
    // prórroga/penaltis), usamos el ganador que haya elegido el admin; si no
    // eligió ninguno, queda DRAW (el cuadro no acreditará campeón).
    const winner =
      h > a
        ? "HOME_TEAM"
        : a > h
        ? "AWAY_TEAM"
        : winnerInput ?? "DRAW";
    await admin
      .from("matches")
      .update({
        home_score: h,
        away_score: a,
        winner,
        status: "FINISHED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);
  }

  // Recalcular tras el cambio.
  await computeGroupResults(admin);
  const recalc = await recalcAll(admin);

  return NextResponse.json({ ok: true, recalc });
}
