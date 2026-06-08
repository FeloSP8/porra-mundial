// ============================================================================
//  Puntuación del CUADRO (bracket).
//
//  Regla acordada: 1 punto por cada cruce cuyo GANADOR aciertes (el equipo que
//  el jugador colocó avanzando desde ese cruce coincide con el que realmente
//  avanzó), + 1 punto por acertar el CAMPEÓN.
//
//  Función pura: recibe el cuadro pronosticado del jugador (slot -> equipo) y
//  los ganadores reales por slot (slot -> equipo que realmente avanzó), y
//  devuelve los puntos por slot. Así el recálculo del servidor solo tiene que
//  construir el mapa de ganadores reales y delegar aquí.
// ============================================================================

/**
 * @param predicted  slot -> equipo que el jugador hizo avanzar desde ese cruce.
 *                   Incluye "champion" para el ganador del torneo.
 * @param realWinners slot -> equipo que realmente avanzó (mismo formato).
 *                    Si un slot aún no tiene resultado, no debe aparecer aquí.
 * @returns slot -> puntos (0 o 1). Solo incluye slots con resultado real.
 */
export function bracketPoints(
  predicted: Record<string, string>,
  realWinners: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of Object.keys(realWinners)) {
    const real = realWinners[slot];
    const pred = predicted[slot];
    out[slot] = pred && real && pred === real ? 1 : 0;
  }
  return out;
}

/** Total de puntos del cuadro (suma de bracketPoints). */
export function bracketTotal(
  predicted: Record<string, string>,
  realWinners: Record<string, string>
): number {
  const pts = bracketPoints(predicted, realWinners);
  return Object.values(pts).reduce((a, b) => a + b, 0);
}

// ----------------------------------------------------------------------------
//  Puntuación REAL del cuadro (la que usa el recálculo del servidor).
//
//  Como la asignación de terceros del jugador es propia, no podemos casar cada
//  slot con un partido real concreto. En su lugar puntuamos por RONDA: 1 punto
//  por cada equipo que el jugador hizo AVANZAR a una ronda y que realmente
//  avanzó a esa ronda. El "campeón" es la ronda final (ganador del torneo).
//
//  predictedByRound: ronda -> conjunto de equipos que el jugador puso en esa
//    ronda (es decir, que ganaron el cruce de la ronda anterior). Para "champion"
//    es el ganador de la final.
//  realByRound: ronda -> conjunto de equipos que realmente alcanzaron esa ronda.
// ----------------------------------------------------------------------------

export type RoundKey = "r16" | "qf" | "sf" | "final" | "champion";

export function bracketPointsByRound(
  predictedByRound: Record<RoundKey, Set<string>>,
  realByRound: Record<RoundKey, Set<string>>
): { perRound: Record<RoundKey, number>; total: number } {
  const rounds: RoundKey[] = ["r16", "qf", "sf", "final", "champion"];
  const perRound = {} as Record<RoundKey, number>;
  let total = 0;
  for (const r of rounds) {
    const pred = predictedByRound[r] ?? new Set<string>();
    const real = realByRound[r] ?? new Set<string>();
    let n = 0;
    for (const team of pred) if (real.has(team)) n++;
    perRound[r] = n;
    total += n;
  }
  return { perRound, total };
}
