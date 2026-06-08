// ============================================================================
//  Carga de datos para la vista de jornadas (home y /jornadas).
//
//  Toma el id del usuario actual y devuelve:
//   - los partidos del Mundial (con info de fase),
//   - los jugadores,
//   - los pronósticos VISIBLES PARA ESE USUARIO (ya filtrados por privacidad),
//   - el conjunto de fases cerradas.
//
//  Filtrado de privacidad: ver `lib/predictionVisibility.ts`. Se hace AQUÍ en
//  el servidor para que ningún pronóstico ajeno llegue al cliente.
// ============================================================================

import { createClient } from "@/lib/supabase/server";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import { filterVisiblePredictions } from "@/lib/predictionVisibility";
import type {
  MatchdayMatch,
  UserSlim,
  PredictionSlim,
} from "@/components/MatchdayView";

export type MatchdayData = {
  matches: MatchdayMatch[];
  users: UserSlim[];
  predictions: PredictionSlim[];
  closedPhaseKeys: string[];
};

export async function loadMatchdayData(currentUserId: string): Promise<MatchdayData> {
  const supabase = createClient();

  const [
    { data: phases },
    { data: matchesRaw },
    { data: users },
    { data: subsRaw },
  ] = await Promise.all([
    supabase.from("phases").select("*").order("order"),
    supabase
      .from("matches")
      .select(
        "id, phase_id, matchday, group_label, home_team, away_team, kickoff, home_score, away_score, status"
      ),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name"),
    supabase.from("submissions").select("user_id, phase_id"),
  ]);

  const phaseById = new Map<number, Phase>();
  const closedPhaseKeys: string[] = [];
  for (const p of (phases ?? []) as Phase[]) {
    phaseById.set(p.id, p);
    if (!phaseAcceptsSubmissions(p)) closedPhaseKeys.push(p.key);
  }
  const closedSet = new Set(closedPhaseKeys);

  const mySubmittedPhaseIds = new Set(
    (subsRaw ?? [])
      .filter((s) => s.user_id === currentUserId)
      .map((s) => s.phase_id)
  );
  const submittedByPhase = new Map<number, Set<string>>();
  for (const s of subsRaw ?? []) {
    if (!submittedByPhase.has(s.phase_id))
      submittedByPhase.set(s.phase_id, new Set());
    submittedByPhase.get(s.phase_id)!.add(s.user_id);
  }

  const matches: MatchdayMatch[] = (matchesRaw ?? [])
    .map((m: any) => {
      const phase = phaseById.get(m.phase_id);
      if (!phase) return null;
      return {
        id: m.id,
        phase_key: phase.key,
        phase_name: phase.name,
        matchday: m.matchday,
        group_label: m.group_label,
        home_team: m.home_team,
        away_team: m.away_team,
        kickoff: m.kickoff,
        home_score: m.home_score,
        away_score: m.away_score,
        status: m.status,
      } satisfies MatchdayMatch;
    })
    .filter(Boolean) as MatchdayMatch[];

  const allMatchIds = matches.map((m) => m.id);
  const { data: predsRaw } = allMatchIds.length
    ? await supabase
        .from("predictions")
        .select("user_id, match_id, pred_home, pred_away, points_awarded")
        .in("match_id", allMatchIds)
    : { data: [] as any[] };

  const phaseKeyOfMatch = new Map<number, string>();
  const phaseIdOfMatch = new Map<number, number>();
  for (const m of matchesRaw ?? []) {
    const p = phaseById.get(m.phase_id);
    if (p) {
      phaseKeyOfMatch.set(m.id, p.key);
      phaseIdOfMatch.set(m.id, p.id);
    }
  }

  const predictions: PredictionSlim[] = filterVisiblePredictions(
    (predsRaw ?? []) as any,
    {
      currentUserId,
      phaseKeyOfMatch,
      phaseIdOfMatch,
      closedPhaseKeys: closedSet,
      mySubmittedPhaseIds,
      submittedByPhase,
    }
  ) as PredictionSlim[];

  return {
    matches,
    users: (users ?? []) as UserSlim[],
    predictions,
    closedPhaseKeys,
  };
}
