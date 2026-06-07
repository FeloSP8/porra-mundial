// ============================================================================
//  Recálculo de puntos. Reutilizado por el cron y por el panel admin.
//  Recibe un cliente de Supabase con service_role (salta RLS).
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { matchPoints, groupOrderPoints } from "./scoring";
import { groupTable, rankMap, type TableMatch } from "./groupTable";

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
