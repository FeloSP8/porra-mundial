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
 * Bracket OFICIAL del Mundial 2026 (matches 73-88 de la Wikipedia/FIFA).
 * Los partidos están ORDENADOS de modo que pares consecutivos (0-1, 2-3, …)
 * forman cada cruce de la Ronda de 16, respetando el árbol oficial:
 *   R16#1 = M74 vs M77, R16#2 = M73 vs M75, R16#3 = M76 vs M78,
 *   R16#4 = M79 vs M80, R16#5 = M83 vs M84, R16#6 = M81 vs M82,
 *   R16#7 = M86 vs M88, R16#8 = M85 vs M87.
 *
 * Cada ganador de grupo aparece 1 vez, cada segundo 1 vez, y hay 8 slots de
 * "tercero" (los 8 mejores terceros). Verificado por bracket.test.ts.
 */
type Source =
  | { type: "winner"; group: string }
  | { type: "runnerup"; group: string }
  | { type: "third" };

export const R32_MATCHES: { id: string; home: Source; away: Source }[] = [
  // r32-1 = M74 : W-E vs 3rd      ┐ R16#1
  { id: "r32-1", home: { type: "winner", group: "E" }, away: { type: "third" } },
  // r32-2 = M77 : W-I vs 3rd      ┘
  { id: "r32-2", home: { type: "winner", group: "I" }, away: { type: "third" } },
  // r32-3 = M73 : RU-A vs RU-B    ┐ R16#2
  { id: "r32-3", home: { type: "runnerup", group: "A" }, away: { type: "runnerup", group: "B" } },
  // r32-4 = M75 : W-F vs RU-C     ┘
  { id: "r32-4", home: { type: "winner", group: "F" }, away: { type: "runnerup", group: "C" } },
  // r32-5 = M76 : W-C vs RU-F     ┐ R16#3
  { id: "r32-5", home: { type: "winner", group: "C" }, away: { type: "runnerup", group: "F" } },
  // r32-6 = M78 : RU-E vs RU-I    ┘
  { id: "r32-6", home: { type: "runnerup", group: "E" }, away: { type: "runnerup", group: "I" } },
  // r32-7 = M79 : W-A vs 3rd      ┐ R16#4
  { id: "r32-7", home: { type: "winner", group: "A" }, away: { type: "third" } },
  // r32-8 = M80 : W-L vs 3rd      ┘
  { id: "r32-8", home: { type: "winner", group: "L" }, away: { type: "third" } },
  // r32-9 = M83 : RU-K vs RU-L    ┐ R16#5
  { id: "r32-9", home: { type: "runnerup", group: "K" }, away: { type: "runnerup", group: "L" } },
  // r32-10 = M84 : W-H vs RU-J    ┘
  { id: "r32-10", home: { type: "winner", group: "H" }, away: { type: "runnerup", group: "J" } },
  // r32-11 = M81 : W-D vs 3rd     ┐ R16#6
  { id: "r32-11", home: { type: "winner", group: "D" }, away: { type: "third" } },
  // r32-12 = M82 : W-G vs 3rd     ┘
  { id: "r32-12", home: { type: "winner", group: "G" }, away: { type: "third" } },
  // r32-13 = M86 : W-J vs RU-H    ┐ R16#7
  { id: "r32-13", home: { type: "winner", group: "J" }, away: { type: "runnerup", group: "H" } },
  // r32-14 = M88 : RU-D vs RU-G   ┘
  { id: "r32-14", home: { type: "runnerup", group: "D" }, away: { type: "runnerup", group: "G" } },
  // r32-15 = M85 : W-B vs 3rd     ┐ R16#8
  { id: "r32-15", home: { type: "winner", group: "B" }, away: { type: "third" } },
  // r32-16 = M87 : W-K vs 3rd     ┘
  { id: "r32-16", home: { type: "winner", group: "K" }, away: { type: "third" } },
];

/**
 * Árbol de avance: pares consecutivos forman la ronda siguiente.
 * r16[k] = ganadores de r32[2k] y r32[2k+1], qf[k] de r16[2k]/r16[2k+1], etc.
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

export type ThirdStat = { points: number; gd: number; gf: number };

/**
 * Devuelve el grupo del que proviene el equipo en una fuente winner/runnerup,
 * o null para third.
 */
function sourceGroup(s: Source): string | null {
  return s.type === "third" ? null : s.group;
}

/**
 * Construye los emparejamientos iniciales de R32 a partir del orden de grupos
 * pronosticado por el jugador.
 *
 * Los 8 mejores terceros se eligen POR MÉRITO (puntos → dif. de goles → goles a
 * favor), igual que la regla oficial de la FIFA. Cada tercero se asigna a un
 * primero de grupo de modo que NUNCA se enfrente al primero de su propio grupo
 * (regla oficial del cuadro). No replicamos la tabla exacta de 495 escenarios
 * de FIFA (no es pública de forma usable), pero el reparto es coherente y justo.
 *
 * @param rankByGroup mapa "A".."L" -> array de equipos ordenados [1º,2º,3º,4º]
 * @param thirdsStats opcional: estadísticas de cada tercero para elegir los 8
 *        mejores. Si falta, se ordenan por grupo (peor: orden alfabético).
 * @param teamGroup opcional: mapa equipo -> grupo (para evitar choque con su
 *        propio grupo). Si falta, se deduce de rankByGroup.
 */
export function buildR32FromGroups(
  rankByGroup: Record<string, string[]>,
  thirdsStats?: Record<string, ThirdStat>,
  teamGroup?: Record<string, string>
): Record<string, { home: string | null; away: string | null }> {
  const teamFor = (s: Source): string | null => {
    if (s.type === "winner") return rankByGroup[s.group]?.[0] ?? null;
    if (s.type === "runnerup") return rankByGroup[s.group]?.[1] ?? null;
    return null;
  };

  // Mapa equipo -> grupo (deducido si no se pasa).
  const groupOf: Record<string, string> = { ...(teamGroup ?? {}) };
  if (!teamGroup) {
    for (const g of GROUP_LABELS) {
      for (const t of rankByGroup[g] ?? []) if (t) groupOf[t] = g;
    }
  }

  // Terceros candidatos (uno por grupo, si existe) con su grupo.
  const thirds: string[] = [];
  for (const g of GROUP_LABELS) {
    const t = rankByGroup[g]?.[2];
    if (t) thirds.push(t);
  }

  // Elegir los 8 MEJORES terceros por mérito.
  const best8 = [...thirds]
    .sort((a, b) => {
      const A = thirdsStats?.[a] ?? { points: 0, gd: 0, gf: 0 };
      const B = thirdsStats?.[b] ?? { points: 0, gd: 0, gf: 0 };
      if (B.points !== A.points) return B.points - A.points;
      if (B.gd !== A.gd) return B.gd - A.gd;
      if (B.gf !== A.gf) return B.gf - A.gf;
      return a.localeCompare(b);
    })
    .slice(0, 8);

  // Slots de tercero, en orden, con el grupo del PRIMERO contra el que jugarían.
  const thirdSlots: { matchId: string; side: "home" | "away"; winnerGroup: string }[] =
    [];
  for (const m of R32_MATCHES) {
    if (m.home.type === "third") {
      thirdSlots.push({
        matchId: m.id,
        side: "home",
        winnerGroup: sourceGroup(m.away)!, // el otro lado siempre es el winner
      });
    }
    if (m.away.type === "third") {
      thirdSlots.push({
        matchId: m.id,
        side: "away",
        winnerGroup: sourceGroup(m.home)!,
      });
    }
  }

  // Asignar cada tercero a un slot de modo que no choque con su propio grupo.
  // Backtracking: con 8 terceros y 8 slots casi siempre hay solución directa.
  const assignment = assignThirds(best8, thirdSlots, groupOf);

  const result: Record<string, { home: string | null; away: string | null }> = {};
  for (const m of R32_MATCHES) {
    result[m.id] = {
      home: m.home.type === "third" ? null : teamFor(m.home),
      away: m.away.type === "third" ? null : teamFor(m.away),
    };
  }
  for (const slot of thirdSlots) {
    const team = assignment[slot.matchId + "-" + slot.side] ?? null;
    result[slot.matchId][slot.side] = team;
  }
  return result;
}

/**
 * Asigna terceros a slots evitando que un tercero juegue contra el primero de
 * su propio grupo. Devuelve mapa "matchId-side" -> equipo. Backtracking simple.
 */
function assignThirds(
  thirds: string[],
  slots: { matchId: string; side: "home" | "away"; winnerGroup: string }[],
  groupOf: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  const used = new Set<number>();

  function ok(thirdIdx: number, slotIdx: number): boolean {
    return groupOf[thirds[thirdIdx]] !== slots[slotIdx].winnerGroup;
  }

  function solve(slotIdx: number): boolean {
    if (slotIdx >= slots.length) return true;
    for (let t = 0; t < thirds.length; t++) {
      if (used.has(t) || !ok(t, slotIdx)) continue;
      used.add(t);
      result[slots[slotIdx].matchId + "-" + slots[slotIdx].side] = thirds[t];
      if (solve(slotIdx + 1)) return true;
      used.delete(t);
      delete result[slots[slotIdx].matchId + "-" + slots[slotIdx].side];
    }
    return false;
  }

  if (!solve(0)) {
    // Sin solución que respete la restricción: asignación directa por orden.
    slots.forEach((s, i) => {
      if (thirds[i]) result[s.matchId + "-" + s.side] = thirds[i];
    });
  }
  return result;
}
