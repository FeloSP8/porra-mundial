// ============================================================================
//  Recálculo de puntos. Reutilizado por el cron y por el panel admin.
//  Recibe un cliente de Supabase con service_role (salta RLS).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPoints, groupOrderPoints } from "./scoring";
import { groupTable, rankMap, type TableMatch } from "./groupTable";
import {
  bracketPointsByRound,
  type RoundKey,
} from "./bracketScoring";
import { syncCalendar } from "./syncCalendar";

/**
 * Recalcula points_awarded de TODAS las predicciones de partidos terminados,
 * y de los pronósticos de orden de grupo según group_results.
 * Es idempotente: recalcula desde cero cada vez.
 */
export async function recalcAll(admin: SupabaseClient): Promise<{
  matchesScored: number;
  predictionsUpdated: number;
  groupRowsUpdated: number;
}> {
  // --- 1) Puntos por partido ---
  const { data: matches } = await admin
    .from("matches")
    .select("id, home_score, away_score, status");

  const finished = (matches ?? []).filter(
    (m) =>
      m.status === "FINISHED" &&
      m.home_score !== null &&
      m.away_score !== null
  );
  const realByMatch = new Map<number, { home: number; away: number }>();
  for (const m of finished) {
    realByMatch.set(m.id, { home: m.home_score!, away: m.away_score! });
  }

  const { data: preds } = await admin
    .from("predictions")
    .select("id, match_id, pred_home, pred_away, points_awarded");

  let predictionsUpdated = 0;
  for (const p of preds ?? []) {
    const real = realByMatch.get(p.match_id) ?? null;
    const pts = matchPoints(
      { home: p.pred_home, away: p.pred_away },
      real
    );
    if (pts !== p.points_awarded) {
      await admin
        .from("predictions")
        .update({ points_awarded: pts })
        .eq("id", p.id);
      predictionsUpdated++;
    }
  }

  // --- 2) Puntos por orden de grupos ---
  const { data: groupResults } = await admin
    .from("group_results")
    .select("group_label, team, rank");

  // real[group] = { team: rank }
  const realGroups: Record<string, Record<string, number>> = {};
  for (const g of groupResults ?? []) {
    (realGroups[g.group_label] ??= {})[g.team] = g.rank;
  }

  const { data: gsp } = await admin
    .from("group_standings_predictions")
    .select("id, user_id, group_label, team, predicted_rank, points_awarded");

  // Agrupar predicciones por (user, group) para puntuar grupo a grupo.
  let groupRowsUpdated = 0;
  for (const row of gsp ?? []) {
    const real = realGroups[row.group_label];
    let pts = 0;
    if (real && real[row.team] !== undefined) {
      // puntúa cada equipo individualmente (1 fila = 1 equipo)
      pts = groupOrderPoints(
        { [row.team]: row.predicted_rank },
        { [row.team]: real[row.team] }
      );
    }
    if (pts !== row.points_awarded) {
      await admin
        .from("group_standings_predictions")
        .update({ points_awarded: pts })
        .eq("id", row.id);
      groupRowsUpdated++;
    }
  }

  return {
    matchesScored: finished.length,
    predictionsUpdated,
    groupRowsUpdated,
  };
}

/**
 * A partir de los partidos de grupos terminados, calcula la clasificación
 * real de cada grupo (puntos, dif. de goles, goles a favor) y la guarda en
 * group_results. Solo escribe un grupo si TODOS sus partidos han terminado.
 */
export async function computeGroupResults(
  admin: SupabaseClient
): Promise<{ groupsComputed: number }> {
  const { data: matches } = await admin
    .from("matches")
    .select(
      "group_label, home_team, away_team, home_score, away_score, status"
    )
    .not("group_label", "is", null);

  const byGroup: Record<string, typeof matches> = {};
  for (const m of matches ?? []) {
    (byGroup[m.group_label!] ??= []).push(m);
  }

  let groupsComputed = 0;
  for (const [label, ms] of Object.entries(byGroup)) {
    const all = ms ?? [];
    const allFinished =
      all.length > 0 &&
      all.every(
        (m) =>
          m.status === "FINISHED" &&
          m.home_score !== null &&
          m.away_score !== null
      );
    if (!allFinished) continue;

    // Misma lógica oficial (con head-to-head) que la tabla en vivo.
    const teams = new Set<string>();
    for (const m of all) {
      teams.add(m.home_team);
      teams.add(m.away_team);
    }
    const order = rankMap(groupTable([...teams], all as TableMatch[]));

    const rows = Object.entries(order).map(([team, rank]) => ({
      group_label: label,
      team,
      rank,
    }));

    await admin
      .from("group_results")
      .upsert(rows, { onConflict: "group_label,team" });
    groupsComputed++;
  }

  return { groupsComputed };
}

/**
 * Recalcula los puntos del CUADRO (bracket_predictions).
 *
 * Equipos REALES por ronda: derivados de los partidos KO ya disputados. Un
 * equipo "alcanzó" una ronda si participa en un partido de esa stage:
 *   LAST_16 → r16, QUARTER_FINALS → qf, SEMI_FINALS → sf, FINAL → final.
 * El campeón real = ganador del partido FINAL terminado.
 *
 * Para cada jugador, sus equipos "avanzados" por ronda salen de
 * bracket_predictions (round = r16|qf|sf|final|champion). Se da 1 punto por
 * equipo que el jugador hizo avanzar a una ronda y que realmente la alcanzó.
 */
export async function recalcBracket(admin: SupabaseClient): Promise<{
  bracketRowsUpdated: number;
}> {
  // 1) Equipos reales por ronda (de los partidos KO).
  const { data: koMatches } = await admin
    .from("matches")
    .select("stage, home_team, away_team, status, winner");

  const realByRound: Record<RoundKey, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(),
    champion: new Set(),
  };
  const stageToRound: Record<string, RoundKey> = {
    LAST_16: "r16",
    QUARTER_FINALS: "qf",
    SEMI_FINALS: "sf",
    FINAL: "final",
  };

  for (const m of koMatches ?? []) {
    const round = stageToRound[m.stage as string];
    if (!round) continue;
    // Participar en un partido de esa stage = haber alcanzado esa ronda.
    if (m.home_team) realByRound[round].add(m.home_team);
    if (m.away_team) realByRound[round].add(m.away_team);
    // Campeón = ganador REAL del FINAL (incluye prórroga/penaltis). Usamos
    // `winner` y no el marcador, porque a los 90' la final puede ir empatada.
    if (m.stage === "FINAL" && m.status === "FINISHED") {
      let champ: string | null = null;
      if (m.winner === "HOME_TEAM") champ = m.home_team;
      else if (m.winner === "AWAY_TEAM") champ = m.away_team;
      if (champ) realByRound.champion.add(champ);
    }
  }

  // 2) Por jugador, sus equipos avanzados por ronda (de bracket_predictions).
  const { data: bp } = await admin
    .from("bracket_predictions")
    .select("id, user_id, round, team, points_awarded");

  // Agrupar por usuario.
  const byUser = new Map<
    string,
    { id: number; round: string; team: string; points: number }[]
  >();
  for (const row of bp ?? []) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push({
      id: row.id,
      round: row.round,
      team: row.team,
      points: row.points_awarded,
    });
  }

  let bracketRowsUpdated = 0;

  for (const [, rows] of byUser) {
    // predictedByRound: equipos que el jugador hizo avanzar a cada ronda.
    // - El ganador de un cruce r32 avanza a r16; de r16 a qf; etc.
    //   Pero en bracket_predictions guardamos round = ronda del CRUCE.
    //   El equipo que gana el cruce "r32" avanza a "r16", etc. Para puntuar por
    //   ronda alcanzada, mapeamos: ganador de cruce de ronda X alcanza la ronda
    //   siguiente. round 'final' → champion. round 'champion' → champion.
    const predictedByRound: Record<RoundKey, Set<string>> = {
      r16: new Set(),
      qf: new Set(),
      sf: new Set(),
      final: new Set(),
      champion: new Set(),
    };
    const advanceTo: Record<string, RoundKey | null> = {
      r32: "r16",
      r16: "qf",
      qf: "sf",
      sf: "final",
      final: "champion",
      champion: "champion",
    };
    for (const r of rows) {
      const target = advanceTo[r.round];
      if (target) predictedByRound[target].add(r.team);
    }

    const { perRound } = bracketPointsByRound(predictedByRound, realByRound);

    // 3) Asignar puntos a cada fila: 1 si el equipo de esa fila alcanzó la
    //    ronda a la que avanza. Recalculamos fila a fila para persistir.
    void perRound;
    for (const r of rows) {
      const target = advanceTo[r.round];
      const reached =
        target && realByRound[target] ? realByRound[target].has(r.team) : false;
      const pts = reached ? 1 : 0;
      if (pts !== r.points) {
        await admin
          .from("bracket_predictions")
          .update({ points_awarded: pts })
          .eq("id", r.id);
        bracketRowsUpdated++;
      }
    }
  }

  return { bracketRowsUpdated };
}

/** Puntos que se restan por cada partido no pronosticado al cerrarse la fase. */
export const PENALTY_PER_MISSING = 2;

/**
 * Penalización (puntos negativos) de un jugador en una fase: -2 por cada
 * partido sin marcador. Función pura → testeable.
 */
export function computePenalty(
  totalMatches: number,
  filledCount: number
): { missing: number; points: number } {
  const missing = Math.max(0, totalMatches - filledCount);
  // `missing === 0` → puntos 0 (evita el -0 de JS).
  return { missing, points: missing === 0 ? 0 : -missing * PENALTY_PER_MISSING };
}

/**
 * Auto-apertura de la siguiente fase cuando todos los partidos de la anterior
 * han terminado. Establece el deadline al kickoff del primer partido de la
 * nueva fase (o null si todavía no se conocen los cruces).
 *
 * Idempotente: si la siguiente fase ya está abierta no hace nada. Tampoco
 * REABRE una fase que ya empezó (con partidos terminados, marcadores reales o
 * cuyo primer partido ya arrancó), para no resucitar una ronda en curso.
 * NO actúa sobre la fase virtual 'bracket'.
 */
export async function autoOpenNextPhases(admin: SupabaseClient): Promise<{
  phasesOpened: number;
}> {
  const { data: phases } = await admin
    .from("phases")
    .select("id, key, order, is_open")
    .neq("key", "bracket")
    .order("order");

  if (!phases || phases.length === 0) return { phasesOpened: 0 };

  let phasesOpened = 0;

  for (let i = 0; i < phases.length - 1; i++) {
    const current = phases[i];
    const next = phases[i + 1];

    if (next.is_open) continue; // ya abierta

    // ¿Todos los partidos de la fase actual han terminado?
    const { data: currentMatches } = await admin
      .from("matches")
      .select("id, status")
      .eq("phase_id", current.id);

    const matches = currentMatches ?? [];
    if (matches.length === 0) continue; // aún sin partidos cargados
    if (!matches.every((m) => m.status === "FINISHED")) continue;

    // Partidos de la siguiente fase (estado, hora y marcador).
    const { data: nextMatches } = await admin
      .from("matches")
      .select("kickoff, status, home_score, away_score")
      .eq("phase_id", next.id);
    const nm = nextMatches ?? [];

    // NUNCA reabrir una fase que YA empezó: si tiene algún partido terminado,
    // algún marcador real, o su primer partido ya arrancó, se queda como está.
    const nowMs = Date.now();
    const yaEmpezo = nm.some(
      (m) =>
        m.status === "FINISHED" ||
        m.home_score !== null ||
        m.away_score !== null ||
        (m.kickoff && Date.parse(m.kickoff) <= nowMs)
    );
    if (yaEmpezo) continue;

    // Primer kickoff FUTURO de la siguiente fase → deadline de envíos.
    const futuros = nm
      .map((m) => m.kickoff)
      .filter((k): k is string => !!k && Date.parse(k) > nowMs)
      .sort();
    const firstKickoff: string | null = futuros[0] ?? null;

    await admin
      .from("phases")
      .update({ is_open: true, deadline: firstKickoff })
      .eq("id", next.id);

    phasesOpened++;
  }

  return { phasesOpened };
}

/**
 * Auto-cierre de fases vencidas: a quien NO haya enviado una fase de partidos
 * cuyo deadline ya pasó, se le marca como enviado igualmente y se le aplica una
 * penalización de PENALTY_PER_MISSING puntos por cada partido de la fase del
 * que no haya puesto marcador.
 *
 * Idempotente: usa upsert por (user_id, phase_id), así que reejecutarlo no
 * duplica penalizaciones ni envíos. NO aplica a la fase virtual 'bracket'.
 */
export async function autoCloseExpiredPhases(admin: SupabaseClient): Promise<{
  phasesClosed: number;
  playersPenalized: number;
}> {
  const nowIso = new Date().toISOString();

  // Fases de PARTIDOS con deadline vencido (excluye 'bracket').
  const { data: phases } = await admin
    .from("phases")
    .select("id, key, deadline")
    .neq("key", "bracket")
    .not("deadline", "is", null)
    .lt("deadline", nowIso);

  // Todos los jugadores.
  const { data: profiles } = await admin.from("profiles").select("id");
  const allUserIds = (profiles ?? []).map((p) => p.id);

  let phasesClosed = 0;
  let playersPenalized = 0;

  for (const phase of phases ?? []) {
    phasesClosed++;

    // Partidos de la fase.
    const { data: phaseMatches } = await admin
      .from("matches")
      .select("id")
      .eq("phase_id", phase.id);
    const matchIds = (phaseMatches ?? []).map((m) => m.id);
    const totalMatches = matchIds.length;
    if (totalMatches === 0) continue; // sin partidos cargados, nada que penalizar

    // Quién ya tiene submission de esta fase.
    const { data: subs } = await admin
      .from("submissions")
      .select("user_id")
      .eq("phase_id", phase.id);
    const submitted = new Set((subs ?? []).map((s) => s.user_id));

    // Predicciones existentes en esta fase, contadas por jugador.
    const { data: preds } = matchIds.length
      ? await admin
          .from("predictions")
          .select("user_id, match_id")
          .in("match_id", matchIds)
      : { data: [] as { user_id: string; match_id: number }[] };
    const filledByUser = new Map<string, number>();
    for (const p of preds ?? []) {
      filledByUser.set(p.user_id, (filledByUser.get(p.user_id) ?? 0) + 1);
    }

    for (const uid of allUserIds) {
      if (submitted.has(uid)) continue; // ya envió a tiempo → no se toca

      const filled = filledByUser.get(uid) ?? 0;
      const { missing, points } = computePenalty(totalMatches, filled);

      // Marcar como enviado (idempotente) y registrar penalización.
      await admin
        .from("submissions")
        .upsert(
          { user_id: uid, phase_id: phase.id },
          { onConflict: "user_id,phase_id" }
        );
      await admin
        .from("phase_penalties")
        .upsert(
          { user_id: uid, phase_id: phase.id, missing, points },
          { onConflict: "user_id,phase_id" }
        );
      playersPenalized++;
    }
  }

  return { phasesClosed, playersPenalized };
}

/**
 * Proceso COMPLETO de actualización (el mismo que ejecuta la rutina diaria):
 *  1. Sincroniza el calendario con football-data (marcadores + cruces nuevos).
 *  2. Abre la siguiente fase si todos los partidos de la anterior terminaron
 *     (con deadline = primer kickoff futuro de esa fase).
 *  3. Cierra fases vencidas + penaliza a quien no envió.
 *     (con los deadlines ya corregidos del paso 2)
 *  4. Calcula la clasificación real de los grupos completados.
 *  5. Recalcula puntos (partidos/grupos + cuadro).
 *
 * Lo usan el cron (`/api/cron/...`) y el botón del panel admin
 * (`/api/admin/actualizar`), para tener una única fuente de verdad.
 */
export async function runFullUpdate(admin: SupabaseClient) {
  const log: Record<string, unknown> = {};

  // 1) Sincronizar con football-data (no aborta si falla la API).
  //    Primero para tener los kickoffs actualizados antes de abrir/cerrar fases.
  const sync = await syncCalendar(admin);
  if (sync.error) log.footballDataError = sync.error;
  else
    log.calendar = {
      created: sync.created,
      updated: sync.updated,
      skipped: sync.skipped,
    };

  // 2) Abrir la siguiente fase si todos los partidos de la anterior terminaron.
  //    Establece el deadline al primer kickoff futuro para que el paso 3
  //    no la cierre inmediatamente por tener un deadline del seed ya vencido.
  log.autoOpen = await autoOpenNextPhases(admin);

  // 3) Cerrar fases cuyo deadline ya pasó + penalizaciones.
  const nowIso = new Date().toISOString();
  await admin
    .from("phases")
    .update({ is_open: false })
    .lt("deadline", nowIso)
    .eq("is_open", true);
  log.autoClose = await autoCloseExpiredPhases(admin);

  // 4) Clasificación de grupos completados.
  log.groups = await computeGroupResults(admin);

  // 5) Recalcular puntos.
  log.recalc = await recalcAll(admin);
  log.bracket = await recalcBracket(admin);

  return log;
}
