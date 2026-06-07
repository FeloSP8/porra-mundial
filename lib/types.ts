// Tipos de las filas de la BD (los que usamos en la app).

export type Phase = {
  id: number;
  key: string;
  name: string;
  order: number;
  deadline: string | null;
  is_open: boolean;
};

export type Match = {
  id: number;
  external_id: number | null;
  phase_id: number;
  stage: string | null;
  group_label: string | null;
  matchday: number | null;
  home_team: string;
  away_team: string;
  kickoff: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "SCHEDULED" | "FINISHED";
};

export type Prediction = {
  id: number;
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
  points_awarded: number;
};

export type GroupStandingPrediction = {
  id: number;
  user_id: string;
  phase_id: number;
  group_label: string;
  team: string;
  predicted_rank: number;
  points_awarded: number;
};

/** Si la fase admite envíos ahora mismo (abierta y dentro del deadline). */
export function phaseAcceptsSubmissions(phase: Phase): boolean {
  if (!phase.is_open) return false;
  if (phase.deadline && new Date(phase.deadline).getTime() < Date.now()) {
    return false;
  }
  return true;
}
