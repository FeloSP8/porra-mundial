// ============================================================================
//  Construcción y selección de jornadas. Funciones puras compartidas por la
//  home (vista resumen) y por /jornadas (vista completa con tabs).
// ============================================================================

import type { MatchdayMatch } from "@/components/MatchdayView";

export type Matchday = {
  /** Identificador único: "<phaseKey>-<matchday>" o "<phaseKey>" si KO sin matchday. */
  key: string;
  /** Etiqueta corta para tabs: "J1", "R32", ... */
  shortLabel: string;
  /** Etiqueta larga para cabecera. */
  longLabel: string;
  /** Para ordenar cronológicamente. */
  earliestKickoff: number;
  matches: MatchdayMatch[];
};

export function buildMatchdays(matches: MatchdayMatch[]): Matchday[] {
  const groups = new Map<string, MatchdayMatch[]>();
  for (const m of matches) {
    const key =
      m.matchday !== null ? `${m.phase_key}-${m.matchday}` : m.phase_key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const out: Matchday[] = [];
  for (const [key, ms] of groups) {
    const sorted = [...ms].sort((a, b) => {
      const ka = a.kickoff ? Date.parse(a.kickoff) : 0;
      const kb = b.kickoff ? Date.parse(b.kickoff) : 0;
      return ka - kb;
    });
    const first = sorted[0];
    const earliest = first.kickoff ? Date.parse(first.kickoff) : 0;
    const shortLabel =
      first.matchday !== null
        ? `J${first.matchday}`
        : phaseShort(first.phase_key);
    const longLabel =
      first.matchday !== null
        ? `Jornada ${first.matchday} — ${first.phase_name}`
        : first.phase_name;
    out.push({
      key,
      shortLabel,
      longLabel,
      earliestKickoff: earliest,
      matches: sorted,
    });
  }

  out.sort((a, b) => a.earliestKickoff - b.earliestKickoff);
  return out;
}

export function phaseShort(key: string): string {
  return (
    {
      groups: "Grupos",
      r32: "R32",
      r16: "8º",
      qf: "4º",
      sf: "Semis",
      final: "Final",
    } as Record<string, string>
  )[key] ?? key;
}

/**
 * Índice de la jornada por defecto: la primera cuyo último partido aún NO ha
 * terminado (la "actual" o la "próxima"). Si todas terminaron, la última.
 * Si ninguna está aún jugada, la primera.
 */
export function defaultMatchdayIndex(mds: Matchday[]): number {
  if (mds.length === 0) return 0;
  for (let i = 0; i < mds.length; i++) {
    const allFinished = mds[i].matches.every((m) => m.status === "FINISHED");
    if (!allFinished) return i;
  }
  return mds.length - 1;
}
