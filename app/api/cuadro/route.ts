import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import type { BracketRound } from "@/lib/bracket";

/**
 * Guarda (o envía) el pronóstico-cuadro de un jugador.
 *
 * Body JSON:
 * {
 *   submit: boolean,                         // true = "enviar" (bloquea)
 *   picks: [{ slot, round, team }]           // un pick por cruce + champion
 * }
 *
 * Reglas (calcadas de /api/predicciones):
 *  - Requiere sesión.
 *  - La fase virtual 'bracket' debe aceptar envíos (abierta y dentro del deadline).
 *  - Si el jugador ya envió el cuadro, no se permite editar.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { submit, picks } = body ?? {};
  if (!Array.isArray(picks)) {
    return NextResponse.json({ error: "Falta picks" }, { status: 400 });
  }

  // 1) Cargar la fase 'bracket' y validar que acepta envíos.
  const { data: phase } = await supabase
    .from("phases")
    .select("*")
    .eq("key", "bracket")
    .single<Phase>();
  if (!phase) {
    return NextResponse.json(
      { error: "Falta la fase 'bracket' (aplica la migración)." },
      { status: 500 }
    );
  }
  if (!phaseAcceptsSubmissions(phase)) {
    return NextResponse.json(
      { error: "El cuadro está cerrado para envíos." },
      { status: 403 }
    );
  }

  // 2) Si ya envió, bloquear ediciones.
  const { data: existingSub } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("phase_id", phase.id)
    .maybeSingle();
  if (existingSub) {
    return NextResponse.json(
      { error: "Ya enviaste tu cuadro; no se puede editar." },
      { status: 403 }
    );
  }

  // 3) Validar y preparar las filas.
  const validRounds: BracketRound[] = [
    "r32",
    "r16",
    "qf",
    "sf",
    "final",
    "champion",
  ];
  const rows: {
    user_id: string;
    slot: string;
    round: string;
    team: string;
  }[] = [];
  for (const p of picks) {
    const slot = String(p.slot ?? "");
    const round = String(p.round ?? "");
    const team = String(p.team ?? "");
    if (!slot || !team || !validRounds.includes(round as BracketRound)) continue;
    rows.push({ user_id: user.id, slot, round, team });
  }

  // 4) Si "submit", exigir cuadro completo (16+8+4+2+1+1 = 32 picks).
  const REQUIRED_PICKS = 16 + 8 + 4 + 2 + 1 + 1;
  if (submit && rows.length < REQUIRED_PICKS) {
    return NextResponse.json(
      {
        error: `Completa todo el cuadro antes de enviar (${rows.length}/${REQUIRED_PICKS}).`,
      },
      { status: 400 }
    );
  }

  // 5) Guardar (upsert por user+slot). Borramos primero los slots que ya no
  //    estén presentes para que un borrador editado no deje huérfanos.
  if (rows.length > 0) {
    const { error } = await supabase
      .from("bracket_predictions")
      .upsert(rows, { onConflict: "user_id,slot" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 6) Si "submit", registrar el envío.
  if (submit) {
    const { error } = await supabase
      .from("submissions")
      .insert({ user_id: user.id, phase_id: phase.id });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, submitted: !!submit, saved: rows.length });
}
