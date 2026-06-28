// ============================================================================
//  Estadísticas de ACIERTOS — se calculan sobre los resultados REALES ya
//  jugados (partidos FINISHED) y los pronósticos de cada jugador.
//
//  Funciones puras (sin BD) → testeables. La página/servidor se encarga de
//  cargar solo partidos terminados (cuyos pronósticos ya son públicos).
// ============================================================================

import { outcomeOf, matchPoints } from "./scoring";

export type StatUser = { id: string; name: string };

/** Un partido YA jugado con su resultado real (a los 90'). */
export type ResultMatch = {
  id: number;
  home_team: string;
  away_team: string;
  group_label: string | null;
  home_score: number;
  away_score: number;
};

/** Pronóstico de marcador de un jugador para un partido. */
export type Pred = {
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
};

// ---------------------------------------------------------------------------
//  1) Tabla de precisión por jugador.
// ---------------------------------------------------------------------------

export type PlayerAccuracy = {
  userId: string;
  user: string;
  /** partidos terminados que pronosticó */
  predicted: number;
  /** marcadores exactos acertados */
  exact: number;
  /** signos 1/X/2 acertados (incluye los exactos) */
  outcomes: number;
  /** puntos de partidos (3 exacto / 1 signo) */
  points: number;
  /** outcomes / predicted (0..1) */
  accuracy: number;
};

function isExact(p: Pred, m: ResultMatch): boolean {
  return p.pred_home === m.home_score && p.pred_away === m.away_score;
}
function isOutcome(p: Pred, m: ResultMatch): boolean {
  return (
    outcomeOf(p.pred_home, p.pred_away) === outcomeOf(m.home_score, m.away_score)
  );
}

/**
 * Precisión de cada jugador sobre los partidos terminados que pronosticó.
 * Ordena por puntos desc, luego exactos, luego precisión. Excluye a quien no
 * pronosticó ningún partido terminado.
 */
export function playerAccuracy(
  preds: Pred[],
  matches: ResultMatch[],
  users: StatUser[]
): PlayerAccuracy[] {
  const matchOf = new Map(matches.map((m) => [m.id, m]));
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const agg = new Map<
    string,
    { predicted: number; exact: number; outcomes: number; points: number }
  >();

  for (const p of preds) {
    const m = matchOf.get(p.match_id);
    if (!m) continue; // solo partidos terminados
    const e = agg.get(p.user_id) ?? {
      predicted: 0,
      exact: 0,
      outcomes: 0,
      points: 0,
    };
    e.predicted++;
    if (isExact(p, m)) e.exact++;
    if (isOutcome(p, m)) e.outcomes++;
    e.points += matchPoints(
      { home: p.pred_home, away: p.pred_away },
      { home: m.home_score, away: m.away_score }
    );
    agg.set(p.user_id, e);
  }

  const out: PlayerAccuracy[] = [];
  for (const [uid, e] of agg) {
    if (e.predicted === 0) continue;
    out.push({
      userId: uid,
      user: nameOf.get(uid) ?? "—",
      predicted: e.predicted,
      exact: e.exact,
      outcomes: e.outcomes,
      points: e.points,
      accuracy: e.outcomes / e.predicted,
    });
  }
  return out.sort(
    (a, b) =>
      b.points - a.points ||
      b.exact - a.exact ||
      b.accuracy - a.accuracy ||
      a.user.localeCompare(b.user)
  );
}

/** El que más marcadores exactos clavó (null si nadie acertó ninguno). */
export function exactScoreKing(table: PlayerAccuracy[]): PlayerAccuracy | null {
  const best = [...table].sort(
    (a, b) => b.exact - a.exact || b.points - a.points
  )[0];
  return best && best.exact > 0 ? best : null;
}

/**
 * El de mejor olfato: mayor precisión de signo (1/X/2). Exige un mínimo de
 * partidos pronosticados para que el porcentaje sea significativo.
 */
export function bestNose(
  table: PlayerAccuracy[],
  minPredicted = 1
): PlayerAccuracy | null {
  const elegibles = table.filter((p) => p.predicted >= minPredicted);
  const best = [...elegibles].sort(
    (a, b) => b.accuracy - a.accuracy || b.predicted - a.predicted
  )[0];
  return best ?? null;
}

// ---------------------------------------------------------------------------
//  2) "El vidente": acertó el signo cuando (casi) todos los demás fallaron.
// ---------------------------------------------------------------------------

export type LoneHit = {
  userId: string;
  user: string;
  match: ResultMatch;
  pred: { home: number; away: number };
  /** acertó además el marcador exacto */
  exact: boolean;
  /** cuántos jugadores fallaron el signo en ese partido */
  missed: number;
};

/**
 * Partidos donde EXACTAMENTE un jugador acertó el signo y todos los demás lo
 * fallaron. Solo se consideran partidos con al menos `minVoters` pronósticos,
 * para que "estar solo" tenga mérito. Ordena por nº de fallos desc.
 */
export function loneHits(
  preds: Pred[],
  matches: ResultMatch[],
  users: StatUser[],
  minVoters = 3
): LoneHit[] {
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const byMatch = new Map<number, Pred[]>();
  for (const p of preds) {
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, []);
    byMatch.get(p.match_id)!.push(p);
  }

  const out: LoneHit[] = [];
  for (const m of matches) {
    const ps = byMatch.get(m.id);
    if (!ps || ps.length < minVoters) continue;
    const right = ps.filter((p) => isOutcome(p, m));
    if (right.length !== 1) continue; // solo cuando acertó exactamente uno
    const winner = right[0];
    out.push({
      userId: winner.user_id,
      user: nameOf.get(winner.user_id) ?? "—",
      match: m,
      pred: { home: winner.pred_home, away: winner.pred_away },
      exact: isExact(winner, m),
      missed: ps.length - 1,
    });
  }
  return out.sort((a, b) => b.missed - a.missed || Number(b.exact) - Number(a.exact));
}

/** Recuento de aciertos en solitario por jugador (para coronar al "vidente"). */
export function topSeer(
  hits: LoneHit[]
): { user: string; userId: string; count: number } | null {
  const counts = new Map<string, { user: string; count: number }>();
  for (const h of hits) {
    const e = counts.get(h.userId) ?? { user: h.user, count: 0 };
    e.count++;
    counts.set(h.userId, e);
  }
  let best: { user: string; userId: string; count: number } | null = null;
  for (const [userId, e] of counts) {
    if (!best || e.count > best.count) best = { userId, user: e.user, count: e.count };
  }
  return best;
}

// ---------------------------------------------------------------------------
//  3) Maestría en grupos: aciertos de posición en la clasificación de grupos.
// ---------------------------------------------------------------------------

export type GroupPred = {
  user_id: string;
  group_label: string;
  team: string;
  predicted_rank: number;
};
export type GroupResultRow = {
  group_label: string;
  team: string;
  rank: number;
};

export type GroupMastery = {
  userId: string;
  user: string;
  /** posiciones acertadas */
  correct: number;
  /** posiciones evaluadas (solo grupos con resultado) */
  total: number;
  accuracy: number;
  /** grupos con TODAS las posiciones acertadas */
  perfectGroups: number;
};

/**
 * Aciertos de posición de cada jugador en los grupos que ya tienen resultado.
 * Ordena por aciertos desc, luego grupos perfectos.
 */
export function groupMastery(
  preds: GroupPred[],
  results: GroupResultRow[],
  users: StatUser[]
): GroupMastery[] {
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  // realRank[group][team] = rank
  const realRank = new Map<string, Map<string, number>>();
  for (const r of results) {
    if (!realRank.has(r.group_label)) realRank.set(r.group_label, new Map());
    realRank.get(r.group_label)!.set(r.team, r.rank);
  }

  // Por usuario y grupo: aciertos y total dentro de ese grupo.
  const agg = new Map<
    string,
    { correct: number; total: number; perGroup: Map<string, { ok: number; n: number }> }
  >();
  for (const p of preds) {
    const groupReal = realRank.get(p.group_label);
    if (!groupReal) continue; // grupo sin resultado todavía
    const real = groupReal.get(p.team);
    if (real === undefined) continue;
    const e =
      agg.get(p.user_id) ??
      { correct: 0, total: 0, perGroup: new Map<string, { ok: number; n: number }>() };
    const g = e.perGroup.get(p.group_label) ?? { ok: 0, n: 0 };
    g.n++;
    e.total++;
    if (p.predicted_rank === real) {
      g.ok++;
      e.correct++;
    }
    e.perGroup.set(p.group_label, g);
    agg.set(p.user_id, e);
  }

  const out: GroupMastery[] = [];
  for (const [uid, e] of agg) {
    if (e.total === 0) continue;
    let perfectGroups = 0;
    for (const g of e.perGroup.values()) if (g.n > 0 && g.ok === g.n) perfectGroups++;
    out.push({
      userId: uid,
      user: nameOf.get(uid) ?? "—",
      correct: e.correct,
      total: e.total,
      accuracy: e.correct / e.total,
      perfectGroups,
    });
  }
  return out.sort(
    (a, b) =>
      b.correct - a.correct ||
      b.perfectGroups - a.perfectGroups ||
      a.user.localeCompare(b.user)
  );
}

// ---------------------------------------------------------------------------
//  4) Aciertos del cuadro (quién hizo avanzar/campeón a los equipos correctos).
// ---------------------------------------------------------------------------

export type BracketRow = {
  user_id: string;
  round: string; // r32 | r16 | qf | sf | final | champion
  team: string;
  points: number; // points_awarded (1 si el equipo alcanzó la ronda a la que avanzó)
};

export type BracketLeader = {
  userId: string;
  user: string;
  /** aciertos totales de avance (suma de puntos del cuadro) */
  points: number;
  /** acertó el campeón */
  championHit: boolean;
};

/**
 * Ranking del cuadro: suma de aciertos de avance por jugador + si clavó el
 * campeón. Ordena por puntos desc.
 */
export function bracketLeaders(
  rows: BracketRow[],
  users: StatUser[]
): BracketLeader[] {
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const agg = new Map<string, { points: number; champion: boolean }>();
  for (const r of rows) {
    const e = agg.get(r.user_id) ?? { points: 0, champion: false };
    e.points += r.points;
    if (r.round === "champion" && r.points > 0) e.champion = true;
    agg.set(r.user_id, e);
  }
  const out: BracketLeader[] = [];
  for (const [uid, e] of agg) {
    out.push({
      userId: uid,
      user: nameOf.get(uid) ?? "—",
      points: e.points,
      championHit: e.champion,
    });
  }
  return out.sort(
    (a, b) => b.points - a.points || a.user.localeCompare(b.user)
  );
}
