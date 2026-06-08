// ============================================================================
//  Filtrado de pronósticos por privacidad.
//
//  Reglas (en este orden):
//   1. Cada usuario siempre ve los suyos.
//   2. Si la fase del partido está CERRADA → todos los pronósticos visibles.
//   3. Si la fase está abierta:
//        - El usuario actual NO envió esta fase → no ve nada de los demás.
//        - El usuario actual SÍ envió esta fase → ve los pronósticos de los
//          jugadores que también han enviado esta fase.
//
//  Esto se aplica en el SERVIDOR antes de mandar nada al cliente.
// ============================================================================

export type PredictionRow = {
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
  points_awarded: number;
};

export type FilterContext = {
  /** Usuario actual (el que va a ver la página). */
  currentUserId: string;
  /** Para cada match_id, la phase_key a la que pertenece. */
  phaseKeyOfMatch: Map<number, string>;
  /** Para cada match_id, el phase_id a la que pertenece. */
  phaseIdOfMatch: Map<number, number>;
  /** Conjunto de phase_keys que están CERRADAS (no admiten envíos). */
  closedPhaseKeys: Set<string>;
  /** phase_ids que el usuario actual ya envió. */
  mySubmittedPhaseIds: Set<number>;
  /** phase_id -> conjunto de user_ids que ya enviaron esa fase. */
  submittedByPhase: Map<number, Set<string>>;
};

export function filterVisiblePredictions(
  predictions: PredictionRow[],
  ctx: FilterContext
): PredictionRow[] {
  return predictions.filter((p) => {
    // 1) Siempre veo lo mío.
    if (p.user_id === ctx.currentUserId) return true;

    const phaseKey = ctx.phaseKeyOfMatch.get(p.match_id);
    const phaseId = ctx.phaseIdOfMatch.get(p.match_id);
    if (!phaseKey || phaseId === undefined) return false;

    // 2) Fase cerrada: visibles todos.
    if (ctx.closedPhaseKeys.has(phaseKey)) return true;

    // 3) Fase abierta: solo si YO la envié Y el otro también.
    if (!ctx.mySubmittedPhaseIds.has(phaseId)) return false;
    const submitted = ctx.submittedByPhase.get(phaseId) ?? new Set<string>();
    return submitted.has(p.user_id);
  });
}
