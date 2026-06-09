// ============================================================================
//  Carga del cuadro (bracket) de un jugador desde Supabase.
//
//  Reúne lo necesario para pintar el árbol de un jugador concreto:
//   - su orden de grupos pronosticado (rankByGroup),
//   - los 8 mejores terceros por mérito (recomputando sus tablas de grupo),
//   - los emparejamientos iniciales de R32 (buildR32FromGroups),
//   - sus picks guardados (ganadores de cada cruce).
//
//  Se usa tanto para el cuadro propio como para ver el de otros jugadores.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildR32FromGroups, type ThirdStat } from "./bracket";
import { groupTable, type TableMatch } from "./groupTable";

export type PlayerBracket = {
  hasGroups: boolean;
  initialR32: Record<string, { home: string | null; away: string | null }>;
  picks: Record<string, string>;
};

export async function loadPlayerBracket(
  supabase: SupabaseClient,
  userId: string
): Promise<PlayerBracket> {
  // Orden de grupos pronosticado por el jugador.
  const { data: gsp } = await supabase
    .from("group_standings_predictions")
    .select("group_label, team, predicted_rank")
    .eq("user_id", userId);

  const rankByGroup: Record<string, string[]> = {};
  for (const row of gsp ?? []) {
    (rankByGroup[row.group_label] ??= [])[row.predicted_rank - 1] = row.team;
  }
  const hasGroups = Object.keys(rankByGroup).length > 0;

  // Picks guardados (ganadores de cada cruce).
  const { data: bp } = await supabase
    .from("bracket_predictions")
    .select("slot, team")
    .eq("user_id", userId);
  const picks: Record<string, string> = {};
  for (const r of bp ?? []) picks[r.slot] = r.team;

  if (!hasGroups) {
    return { hasGroups: false, initialR32: {}, picks };
  }

  // Estadísticas de los terceros (para elegir los 8 mejores por mérito).
  const { thirdsStats, teamGroup } = await computeThirdsStats(supabase, userId);
  const initialR32 = buildR32FromGroups(rankByGroup, thirdsStats, teamGroup);

  return { hasGroups: true, initialR32, picks };
}

/**
 * Recomputa las tablas de grupo desde los marcadores pronosticados por el
 * jugador y devuelve, para cada equipo que queda 3º, sus estadísticas, además
 * de un mapa equipo->grupo.
 */
async function computeThirdsStats(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  thirdsStats: Record<string, ThirdStat>;
  teamGroup: Record<string, string>;
}> {
  const { data: groupsPhase } = await supabase
    .from("phases")
    .select("id")
    .eq("key", "groups")
    .single();

  const { data: matchRows } = groupsPhase
    ? await supabase
        .from("matches")
        .select("id, group_label, home_team, away_team")
        .eq("phase_id", groupsPhase.id)
        .not("group_label", "is", null)
    : { data: [] as any[] };

  const matchIds = (matchRows ?? []).map((m: any) => m.id);
  const { data: preds } = matchIds.length
    ? await supabase
        .from("predictions")
        .select("match_id, pred_home, pred_away")
        .eq("user_id", userId)
        .in("match_id", matchIds)
    : { data: [] as any[] };
  const predByMatch = new Map((preds ?? []).map((p: any) => [p.match_id, p]));

  const byGroup: Record<string, { teams: Set<string>; matches: TableMatch[] }> =
    {};
  const teamGroup: Record<string, string> = {};
  for (const m of matchRows ?? []) {
    const g = (byGroup[m.group_label] ??= { teams: new Set(), matches: [] });
    g.teams.add(m.home_team);
    g.teams.add(m.away_team);
    teamGroup[m.home_team] = m.group_label;
    teamGroup[m.away_team] = m.group_label;
    const p = predByMatch.get(m.id);
    g.matches.push({
      home_team: m.home_team,
      away_team: m.away_team,
      home_score: p ? p.pred_home : null,
      away_score: p ? p.pred_away : null,
    });
  }

  const thirdsStats: Record<string, ThirdStat> = {};
  for (const [, g] of Object.entries(byGroup)) {
    const table = groupTable([...g.teams], g.matches);
    const third = table[2];
    if (third) {
      thirdsStats[third.team] = {
        points: third.points,
        gd: third.gd,
        gf: third.gf,
      };
    }
  }

  return { thirdsStats, teamGroup };
}
