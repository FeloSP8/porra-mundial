// ============================================================================
//  Lógica de puntuación — ÚNICA fuente de verdad.
//
//  Funciones puras (sin BD) para poder testearlas fácilmente y para que el
//  cron y el panel admin compartan exactamente el mismo cálculo.
//
//  Los pesos son valores por defecto; cámbialos aquí y se aplican en todo
//  el sistema (recuerda lanzar un recálculo desde el panel admin tras tocarlos).
// ============================================================================

export const SCORING = {
  /** Acertar el marcador exacto de un partido. */
  EXACT_SCORE: 3,
  /** Acertar solo el signo (1 = local, X = empate, 2 = visitante). */
  OUTCOME_ONLY: 1,
  /** Acertar la posición (1..4) de un equipo dentro de su grupo. */
  GROUP_POSITION: 1,
} as const;

export type Outcome = "1" | "X" | "2";

export function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return "1";
  if (home < away) return "2";
  return "X";
}

/**
 * Puntos de un único partido.
 * @param pred  marcador pronosticado { home, away }
 * @param real  marcador real { home, away }
 * @returns puntos obtenidos por ese partido
 */
export function matchPoints(
  pred: { home: number; away: number } | null,
  real: { home: number; away: number } | null
): number {
  if (!pred || !real) return 0;
  if (pred.home === real.home && pred.away === real.away) {
    return SCORING.EXACT_SCORE;
  }
  if (outcomeOf(pred.home, pred.away) === outcomeOf(real.home, real.away)) {
    return SCORING.OUTCOME_ONLY;
  }
  return 0;
}

/**
 * Puntos por acertar el orden de un grupo.
 * Compara, equipo a equipo, la posición pronosticada con la real.
 * @param predicted  mapa equipo -> posición pronosticada (1..4)
 * @param real       mapa equipo -> posición real (1..4)
 * @returns puntos (GROUP_POSITION por cada equipo bien colocado)
 */
export function groupOrderPoints(
  predicted: Record<string, number>,
  real: Record<string, number>
): number {
  let points = 0;
  for (const team of Object.keys(predicted)) {
    if (real[team] !== undefined && predicted[team] === real[team]) {
      points += SCORING.GROUP_POSITION;
    }
  }
  return points;
}

/** Texto humano para la página de reglas (se genera desde SCORING). */
export function scoringRules(): { label: string; points: number }[] {
  return [
    { label: "Marcador exacto de un partido", points: SCORING.EXACT_SCORE },
    {
      label: "Acertar solo el resultado (1, X o 2)",
      points: SCORING.OUTCOME_ONLY,
    },
    {
      label: "Cada equipo bien colocado en su grupo",
      points: SCORING.GROUP_POSITION,
    },
  ];
}
