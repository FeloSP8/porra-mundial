// ============================================================================
//  Constantes del dominio — Porra Mundial 2026
// ============================================================================

/** Las 6 fases en las que los jugadores envían pronósticos. */
export const PHASES = [
  { key: "groups", name: "Fase de grupos", order: 1 },
  { key: "r32", name: "Dieciseisavos (Ronda de 32)", order: 2 },
  { key: "r16", name: "Octavos (Ronda de 16)", order: 3 },
  { key: "qf", name: "Cuartos de final", order: 4 },
  { key: "sf", name: "Semifinales", order: 5 },
  { key: "final", name: "Final", order: 6 },
] as const;

export type PhaseKey = (typeof PHASES)[number]["key"];

export const PHASE_KEYS = PHASES.map((p) => p.key) as PhaseKey[];

export function phaseName(key: string): string {
  return PHASES.find((p) => p.key === key)?.name ?? key;
}

/**
 * Mapeo entre la "stage" que devuelve football-data.org y nuestra fase.
 * football-data usa: GROUP_STAGE, LAST_32, LAST_16, QUARTER_FINALS,
 * SEMI_FINALS, THIRD_PLACE, FINAL.
 */
export const STAGE_TO_PHASE: Record<string, PhaseKey> = {
  GROUP_STAGE: "groups",
  LAST_32: "r32",
  LAST_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  THIRD_PLACE: "final", // el partido por el 3er puesto cuenta en la fase final
  FINAL: "final",
};

/** Las 12 etiquetas de grupo del Mundial 2026 (A..L). */
export const GROUP_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
] as const;

export type GroupLabel = (typeof GROUP_LABELS)[number];

/** Código de la competición Mundial en football-data.org. */
export const FOOTBALL_DATA_COMPETITION = "WC";
