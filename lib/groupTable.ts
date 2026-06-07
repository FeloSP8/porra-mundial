// ============================================================================
//  Clasificación de un grupo con los criterios oficiales del Mundial 2026.
//
//  Función pura (sin BD): se usa tanto en el cliente (vista previa de la tabla
//  según los marcadores que va metiendo el jugador) como en el servidor
//  (para calcular el orden REAL del grupo y puntuar el acierto de posiciones).
//
//  Orden de desempate oficial FIFA 2026 (en este orden):
//    1) Puntos totales.
//    2) HEAD-TO-HEAD entre los empatados:  a) puntos  b) dif. goles  c) goles.
//    3) Dif. de goles en TODO el grupo.
//    4) Goles a favor en TODO el grupo.
//    5) (fair play y ranking FIFA — no aplicables en un pronóstico)
//       → como último recurso, orden alfabético, para que la tabla sea estable.
//
//  Nota sobre el head-to-head: solo se aplica entre el subconjunto de equipos
//  empatados a puntos, comparando únicamente los partidos jugados ENTRE ELLOS.
// ============================================================================

export type TableMatch = {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
};

export type TableRow = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number; // goles a favor
  ga: number; // goles en contra
  gd: number; // diferencia de goles
  points: number;
};

/** Acumula estadísticas de un conjunto de partidos para un conjunto de equipos. */
function tally(teams: string[], matches: TableMatch[]): Record<string, TableRow> {
  const rows: Record<string, TableRow> = {};
  for (const t of teams) {
    rows[t] = {
      team: t,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    };
  }

  for (const m of matches) {
    if (m.home_score === null || m.away_score === null) continue;
    if (!rows[m.home_team] || !rows[m.away_team]) continue;
    const h = rows[m.home_team];
    const a = rows[m.away_team];
    h.played++;
    a.played++;
    h.gf += m.home_score;
    h.ga += m.away_score;
    a.gf += m.away_score;
    a.ga += m.home_score;
    if (m.home_score > m.away_score) {
      h.won++;
      a.lost++;
      h.points += 3;
    } else if (m.home_score < m.away_score) {
      a.won++;
      h.lost++;
      a.points += 3;
    } else {
      h.drawn++;
      a.drawn++;
      h.points += 1;
      a.points += 1;
    }
  }

  for (const t of teams) rows[t].gd = rows[t].gf - rows[t].ga;
  return rows;
}

/**
 * Desempata un grupo de equipos igualados a puntos usando el head-to-head
 * (solo los partidos entre ellos). Devuelve los equipos ordenados.
 * Si el head-to-head no separa del todo, cae a dg/gf global y luego alfabético.
 */
function breakTie(
  tied: string[],
  allMatches: TableMatch[],
  globalRows: Record<string, TableRow>
): string[] {
  if (tied.length === 1) return tied;

  // Mini-liga: solo los partidos jugados ENTRE los empatados.
  const h2hMatches = allMatches.filter(
    (m) => tied.includes(m.home_team) && tied.includes(m.away_team)
  );
  const h2h = tally(tied, h2hMatches);

  return [...tied].sort((x, y) => {
    // 2a) puntos head-to-head
    if (h2h[y].points !== h2h[x].points) return h2h[y].points - h2h[x].points;
    // 2b) diferencia de goles head-to-head
    if (h2h[y].gd !== h2h[x].gd) return h2h[y].gd - h2h[x].gd;
    // 2c) goles a favor head-to-head
    if (h2h[y].gf !== h2h[x].gf) return h2h[y].gf - h2h[x].gf;
    // 3) diferencia de goles global
    if (globalRows[y].gd !== globalRows[x].gd)
      return globalRows[y].gd - globalRows[x].gd;
    // 4) goles a favor global
    if (globalRows[y].gf !== globalRows[x].gf)
      return globalRows[y].gf - globalRows[x].gf;
    // 5) alfabético (estable; sustituye a fair play / ranking FIFA)
    return x.localeCompare(y);
  });
}

/**
 * Devuelve la clasificación final del grupo (filas ordenadas de 1º a último)
 * aplicando los criterios oficiales del Mundial 2026.
 *
 * @param teams    los equipos del grupo
 * @param matches  los partidos del grupo (con marcadores; null = no jugado)
 */
export function groupTable(
  teams: string[],
  matches: TableMatch[]
): TableRow[] {
  const rows = tally(teams, matches);

  // Agrupar por puntos (descendente) y desempatar cada bloque por h2h.
  const byPoints = [...teams].sort((x, y) => rows[y].points - rows[x].points);

  const result: TableRow[] = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i + 1;
    while (
      j < byPoints.length &&
      rows[byPoints[j]].points === rows[byPoints[i]].points
    ) {
      j++;
    }
    const tiedGroup = byPoints.slice(i, j);
    const ordered = breakTie(tiedGroup, matches, rows);
    for (const t of ordered) result.push(rows[t]);
    i = j;
  }

  return result;
}

/**
 * A partir de la clasificación, devuelve el mapa equipo -> posición (1..N).
 * Útil para guardar/puntuar el orden de grupos.
 */
export function rankMap(table: TableRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  table.forEach((row, idx) => {
    map[row.team] = idx + 1;
  });
  return map;
}
