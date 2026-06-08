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
    .select("stage, home_team, away_team, home_score, away_score, status");

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
    // Campeón = ganador del FINAL terminado.
    if (
      m.stage === "FINAL" &&
      m.status === "FINISHED" &&
      m.home_score !== null &&
      m.away_score !== null
    ) {
      const champ =
        m.home_score > m.away_score ? m.home_team : m.away_team;
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
