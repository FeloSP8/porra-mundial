// ============================================================================
//  Estructura del CUADRO (bracket) del Mundial 2026 y construcción a partir
//  del pronóstico de grupos de un jugador.
//
//  Funciones puras (sin BD) → testeables. Las usa la página /cuadro (cliente)
//  y la API de guardado.
//
//  Formato oficial 2026: 12 primeros + 12 segundos + 8 mejores terceros = 32.
//  En R32, los primeros de grupo juegan contra terceros; los segundos entre sí.
//  El árbol R32→R16→QF→SF→Final es fijo (estructura de bracket estándar).
//
//  Sobre los terceros: la asignación oficial FIFA usa una tabla de 495
//  combinaciones según QUÉ 8 grupos clasifican. Como el cuadro se rellena ANTES
//  del Mundial, NO replicamos esas reglas: tomamos los 8 mejores terceros según
//  el propio pronóstico del jugador y los asignamos en orden a los slots de
//  "tercero" del cuadro. Es coherente y propio de cada jugador.
// ============================================================================

import { GROUP_LABELS } from "./constants";

export type BracketRound = "r32" | "r16" | "qf" | "sf" | "final" | "champion";

/** Un cruce (match) del cuadro: dos slots de equipo y a qué slot avanza. */
export type BracketSlot = {
  /** id único del cruce, p.ej. "r32-1", "r16-3", "final". */
  id: string;
  round: BracketRound;
  /** índice dentro de su ronda (0-based). */
  index: number;
};

/**
 * Las 16 eliminatorias de R32. Cada una define sus dos "fuentes" de equipo en
 * términos de posición de grupo:
 *   { type: "winner"|"runnerup", group: "A".."L" }  → equipo concreto del grupo
 *   { type: "third" }  → un slot de "mejor tercero" (se rellenan en orden)
 *
 * Estructura derivada del formato oficial: ganador de grupo vs tercero, o
 * segundo vs segundo. El emparejamiento concreto sigue el cuadro estándar del
 * Mundial 2026 (lados izquierdo/derecho que no se cruzan hasta la final).
 */
type Source =
  | { type: "winner"; group: string }
  | { type: "runnerup"; group: string }
  | { type: "third" };

export const R32_MATCHES: { id: string; home: Source; away: Source }[] = [
  // --- Lado izquierdo ---
  { id: "r32-1", home: { type: "winner", group: "A" }, away: { type: "third" } },
  { id: "r32-2", home: { type: "runnerup", group: "C" }, away: { type: "runnerup", group: "D" } },
  { id: "r32-3", home: { type: "winner", group: "E" }, away: { type: "third" } },
  { id: "r32-4", home: { type: "runnerup", group: "A" }, away: { type: "runnerup", group: "B" } },
  { id: "r32-5", home: { type: "winner", group: "F" }, away: { type: "runnerup", group: "C" } },
  { id: "r32-6", home: { type: "winner", group: "C" }, away: { type: "runnerup", group: "F" } },
  { id: "r32-7", home: { type: "winner", group: "I" }, away: { type: "third" } },
  { id: "r32-8", home: { type: "runnerup", group: "E" }, away: { type: "runnerup", group: "I" } },
  // --- Lado derecho ---
  { id: "r32-9", home: { type: "winner", group: "B" }, away: { type: "third" } },
  { id: "r32-10", home: { type: "winner", group: "L" }, away: { type: "third" } },
  { id: "r32-11", home: { type: "winner", group: "H" }, away: { type: "runnerup", group: "J" } },
  { id: "r32-12", home: { type: "winner", group: "J" }, away: { type: "runnerup", group: "H" } },
  { id: "r32-13", home: { type: "winner", group: "K" }, away: { type: "third" } },
  { id: "r32-14", home: { type: "runnerup", group: "K" }, away: { type: "runnerup", group: "L" } },
  { id: "r32-15", home: { type: "winner", group: "D" }, away: { type: "third" } },
  { id: "r32-16", home: { type: "winner", group: "G" }, away: { type: "third" } },
];

/**
 * Árbol de avance: para cada ronda posterior, qué dos cruces previos alimentan
 * cada nuevo cruce (por índice). r16[k] = ganadores de r32[2k] y r32[2k+1], etc.
 */
export const ROUND_SIZES: Record<Exclude<BracketRound, "champion">, number> = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
};

export const ROUND_ORDER: BracketRound[] = [
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
  "champion",
];

export function nextRound(round: BracketRound): BracketRound | null {
  const i = ROUND_ORDER.indexOf(round);
  return i >= 0 && i < ROUND_ORDER.length - 1 ? ROUND_ORDER[i + 1] : null;
}

/** id de un cruce dado su ronda e índice. "final" e "champion" son singulares. */
export function slotId(round: BracketRound, index: number): string {
  if (round === "final") return "final";
  if (round === "champion") return "champion";
  return `${round}-${index + 1}`;
}

/**
 * Construye los emparejamientos iniciales de R32 a partir del orden de grupos
 * pronosticado por el jugador.
 *
 * @param rankByGroup mapa "A".."L" -> array de equipos ordenados [1º,2º,3º,4º]
 * @param thirdsStats opcional: para elegir los 8 mejores terceros, un mapa
 *        equipo -> { points, gd, gf }. Si falta, se toman los terceros en
 *        orden alfabético de grupo (los 8 primeros).
 * @returns para cada r32-N, los dos equipos { home, away } (o null si falta info)
 */
export function buildR32FromGroups(
  rankByGroup: Record<string, string[]>,
  thirdsStats?: Record<string, { points: number; gd: number; gf: number }>
): Record<string, { home: string | null; away: string | null }> {
  // Equipo concreto para winner/runnerup.
  const teamFor = (s: Source): string | null => {
    if (s.type === "winner") return rankByGroup[s.group]?.[0] ?? null;
    if (s.type === "runnerup") return rankByGroup[s.group]?.[1] ?? null;
    return null; // third → se asigna aparte
  };

  // Terceros candidatos (uno por grupo, si existe).
  const thirds: string[] = [];
  for (const g of GROUP_LABELS) {
    const t = rankByGroup[g]?.[2];
    if (t) thirds.push(t);
  }

  // Elegir los 8 mejores terceros.
  let best8: string[];
  if (thirdsStats) {
    best8 = [...thirds]
      .sort((a, b) => {
        const A = thirdsStats[a] ?? { points: 0, gd: 0, gf: 0 };
        const B = thirdsStats[b] ?? { points: 0, gd: 0, gf: 0 };
        if (B.points !== A.points) return B.points - A.points;
        if (B.gd !== A.gd) return B.gd - A.gd;
        if (B.gf !== A.gf) return B.gf - A.gf;
        return a.localeCompare(b);
      })
      .slice(0, 8);
  } else {
    best8 = thirds.slice(0, 8);
  }

  // Asignar los 8 mejores terceros a los slots "third" en orden de aparición.
  const result: Record<string, { home: string | null; away: string | null }> = {};
  let thirdCursor = 0;
  for (const m of R32_MATCHES) {
    const home =
      m.home.type === "third" ? best8[thirdCursor++] ?? null : teamFor(m.home);
    const away =
      m.away.type === "third" ? best8[thirdCursor++] ?? null : teamFor(m.away);
    result[m.id] = { home, away };
  }
  return result;
}
