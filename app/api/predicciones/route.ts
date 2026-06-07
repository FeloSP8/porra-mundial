import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import { groupTable, rankMap, type TableMatch } from "@/lib/groupTable";

/**
 * Guarda (o envía) los pronósticos de un jugador para una fase.
 *
 * Body JSON:
 * {
 *   phaseKey: string,
 *   submit: boolean,                       // true = "enviar" (bloquea la fase)
 *   matches: [{ matchId, predHome, predAway }]
 * }
 *
 * El orden de los grupos NO se envía: se deriva en el servidor de los
 * marcadores pronosticados (misma lógica de desempates que la tabla en vivo).
 *
 * Reglas:
 *  - Requiere sesión.
 *  - La fase debe aceptar envíos (abierta y dentro del deadline).
 *  - Si el jugador ya envió esta fase, no se permite editar.
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

  const { phaseKey, submit, matches } = body ?? {};
  if (typeof phaseKey !== "string" || !Array.isArray(matches)) {
    return NextResponse.json(
      { error: "Faltan campos: phaseKey o matches" },
      { status: 400 }
    );
  }

  // 1) Cargar la fase y validar que acepta envíos.
  const { data: phase } = await supabase
    .from("phases")
    .select("*")
    .eq("key", phaseKey)
    .single<Phase>();

  if (!phase) {
    return NextResponse.json({ error: "Fase no encontrada" }, { status: 404 });
  }
  if (!phaseAcceptsSubmissions(phase)) {
    return NextResponse.json(
      { error: "Esta fase está cerrada para envíos." },
      { status: 403 }
    );
  }

  // 2) Si ya envió esta fase, bloquear ediciones.
  const { data: existingSub } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("phase_id", phase.id)
    .maybeSingle();

  if (existingSub) {
    return NextResponse.json(
      { error: "Ya enviaste esta fase; no se puede editar." },
      { status: 403 }
    );
  }

  // 3) Validar y preparar los pronósticos de partidos.
  //    Solo aceptamos partidos que pertenecen realmente a esta fase.
  const { data: phaseMatches } = await supabase
    .from("matches")
    .select("id")
    .eq("phase_id", phase.id);
  const validMatchIds = new Set((phaseMatches ?? []).map((m) => m.id));

  const predRows: {
    user_id: string;
    match_id: number;
    pred_home: number;
    pred_away: number;
  }[] = [];

  for (const m of matches) {
    const matchId = Number(m.matchId);
    const predHome = Number(m.predHome);
    const predAway = Number(m.predAway);
    if (!validMatchIds.has(matchId)) continue; // ignora partidos ajenos a la fase
    if (
      !Number.isInteger(predHome) ||
      !Number.isInteger(predAway) ||
      predHome < 0 ||
      predAway < 0 ||
      predHome > 99 ||
      predAway > 99
    ) {
      return NextResponse.json(
        { error: "Marcadores inválidos (deben ser enteros 0-99)." },
        { status: 400 }
      );
    }
    predRows.push({
      user_id: user.id,
      match_id: matchId,
      pred_home: predHome,
      pred_away: predAway,
    });
  }

  // 4) Guardar predicciones de partidos (upsert por user+match).
  if (predRows.length > 0) {
    const { error } = await supabase
      .from("predictions")
      .upsert(predRows, { onConflict: "user_id,match_id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // 5) Derivar el orden de grupos a partir de los marcadores pronosticados
  //    (solo fase de grupos). Ya NO viene del cliente: lo calculamos con la
  //    misma lógica oficial de desempates que la tabla en vivo.
  if (phase.key === "groups") {
    // Cargar todos los partidos de la fase con su grupo y los equipos.
    const { data: phaseMatchRows } = await supabase
      .from("matches")
      .select("id, group_label, home_team, away_team")
      .eq("phase_id", phase.id)
      .not("group_label", "is", null);

    // Marcadores pronosticados por el usuario (los que acabamos de guardar +
    // los que ya tuviera). Releemos para tener la foto completa.
    const allPhaseMatchIds = (phaseMatchRows ?? []).map((m) => m.id);
    const { data: userPreds } = allPhaseMatchIds.length
      ? await supabase
          .from("predictions")
          .select("match_id, pred_home, pred_away")
          .eq("user_id", user.id)
          .in("match_id", allPhaseMatchIds)
      : { data: [] as any[] };
    const predByMatch = new Map(
      (userPreds ?? []).map((p) => [p.match_id, p])
    );

    // Construir, por grupo, los equipos y los TableMatch.
    const groups: Record<
      string,
      { teams: Set<string>; matches: TableMatch[] }
    > = {};
    for (const m of phaseMatchRows ?? []) {
      const g = (groups[m.group_label!] ??= {
        teams: new Set(),
        matches: [],
      });
      g.teams.add(m.home_team);
      g.teams.add(m.away_team);
      const p = predByMatch.get(m.id);
      g.matches.push({
        home_team: m.home_team,
        away_team: m.away_team,
        home_score: p ? p.pred_home : null,
        away_score: p ? p.pred_away : null,
      });
    }

    // Calcular el orden de cada grupo y preparar las filas a guardar.
    const gspRows: {
      user_id: string;
      phase_id: number;
      group_label: string;
      team: string;
      predicted_rank: number;
    }[] = [];
    for (const [label, g] of Object.entries(groups)) {
      const order = rankMap(groupTable([...g.teams], g.matches));
      for (const [team, rank] of Object.entries(order)) {
        gspRows.push({
          user_id: user.id,
          phase_id: phase.id,
          group_label: label,
          team,
          predicted_rank: rank,
        });
      }
    }

    if (gspRows.length > 0) {
      const { error } = await supabase
        .from("group_standings_predictions")
        .upsert(gspRows, { onConflict: "user_id,group_label,team" });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  // 6) Si "submit", registrar el envío (bloquea ediciones futuras).
  if (submit) {
    const { error } = await supabase
      .from("submissions")
      .insert({ user_id: user.id, phase_id: phase.id });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, submitted: !!submit });
}
