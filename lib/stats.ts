// ============================================================================
//  Estadísticas curiosas de los pronósticos de una fase.
//
//  Funciones puras (sin BD) → testeables. Se calculan SOLO sobre los jugadores
//  que han enviado la fase (la privacidad se aplica en la página/servidor).
// ============================================================================

import { outcomeOf, type Outcome } from "./scoring";

export type StatUser = { id: string; name: string };

export type StatMatch = {
  id: number;
  home_team: string;
  away_team: string;
  group_label: string | null;
};

/** Un pronóstico de un jugador para un partido. */
export type StatPrediction = {
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
};

// --- Tipos de salida ---

export type ScoreLine = { home: number; away: number };

export type BiggestWin = {
  user: string;
  match: StatMatch;
  score: ScoreLine;
  diff: number;
};

export type MatchConsensus = {
  match: StatMatch;
  /** reparto de signos 1/X/2 entre los jugadores. */
  outcomes: Record<Outcome, number>;
  /** 0..1: fracción del signo mayoritario (1 = unanimidad total). */
  agreement: number;
  topOutcome: Outcome;
};

export type TeamResult = "win" | "draw" | "loss";

export type TeamConsensus = {
  team: string;
  /** nº de veces que la peña lo hace ganar / empatar / perder (sumando sus partidos) */
  win: number;
  draw: number;
  loss: number;
  /** 0..1: fracción del resultado mayoritario para ese equipo */
  agreement: number;
  /** el resultado mayoritario (en qué están de acuerdo): gana, empata o pierde */
  topResult: TeamResult;
  /** nº total de "opiniones" (jugadores × partidos del equipo) */
  total: number;
};

export type PlayerGoals = {
  user: string;
  avgGoals: number; // media de goles por partido pronosticada
  drawPct: number; // % de empates pronosticados
};

export type Originality = {
  user: string;
  /** nº de partidos donde su signo coincide con el mayoritario / total. */
  alignmentPct: number;
};

const OUTCOMES: Outcome[] = ["1", "X", "2"];

/** Índice rápido: match_id -> (user_id -> pred). */
function indexPredictions(preds: StatPrediction[]) {
  const map = new Map<number, Map<string, StatPrediction>>();
  for (const p of preds) {
    if (!map.has(p.match_id)) map.set(p.match_id, new Map());
    map.get(p.match_id)!.set(p.user_id, p);
  }
  return map;
}

/** Mayor(es) goleada(s) pronosticada(s): mayor diferencia de goles. */
export function biggestWins(
  preds: StatPrediction[],
  matches: StatMatch[],
  users: StatUser[],
  limit = 3
): BiggestWin[] {
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const matchOf = new Map(matches.map((m) => [m.id, m]));
  const rows: BiggestWin[] = [];
  for (const p of preds) {
    const m = matchOf.get(p.match_id);
    if (!m) continue;
    rows.push({
      user: nameOf.get(p.user_id) ?? "—",
      match: m,
      score: { home: p.pred_home, away: p.pred_away },
      diff: Math.abs(p.pred_home - p.pred_away),
    });
  }
  rows.sort(
    (a, b) =>
      b.diff - a.diff ||
      b.score.home + b.score.away - (a.score.home + a.score.away)
  );
  return rows.slice(0, limit);
}

/** Consenso por partido (unanimidad de signo). */
function matchConsensus(
  preds: StatPrediction[],
  matches: StatMatch[]
): MatchConsensus[] {
  const idx = indexPredictions(preds);
  const out: MatchConsensus[] = [];
  for (const m of matches) {
    const byUser = idx.get(m.id);
    if (!byUser || byUser.size === 0) continue;
    const counts: Record<Outcome, number> = { "1": 0, X: 0, "2": 0 };
    for (const p of byUser.values()) {
      counts[outcomeOf(p.pred_home, p.pred_away)]++;
    }
    const total = byUser.size;
    let topOutcome: Outcome = "1";
    for (const o of OUTCOMES) if (counts[o] > counts[topOutcome]) topOutcome = o;
    out.push({
      match: m,
      outcomes: counts,
      agreement: counts[topOutcome] / total,
      topOutcome,
    });
  }
  return out;
}

/** Partidos de mayor unanimidad (acuerdo más alto). */
export function mostAgreedMatches(
  preds: StatPrediction[],
  matches: StatMatch[],
  limit = 3
): MatchConsensus[] {
  return [...matchConsensus(preds, matches)]
    .sort((a, b) => b.agreement - a.agreement)
    .slice(0, limit);
}

/** Partidos más divididos (acuerdo más bajo). */
export function mostDividedMatches(
  preds: StatPrediction[],
  matches: StatMatch[],
  limit = 3
): MatchConsensus[] {
  return [...matchConsensus(preds, matches)]
    .sort((a, b) => a.agreement - b.agreement)
    .slice(0, limit);
}

/**
 * Consenso por equipo: para cada partido de un equipo, cuántos jugadores lo
 * hacen ganar / empatar / perder. Devuelve el más unánime y el más polémico.
 */
export function teamConsensus(
  preds: StatPrediction[],
  matches: StatMatch[]
): TeamConsensus[] {
  const idx = indexPredictions(preds);
  const matchOf = new Map(matches.map((m) => [m.id, m]));
  const agg = new Map<
    string,
    { win: number; draw: number; loss: number; total: number }
  >();
  const ensure = (t: string) =>
    agg.get(t) ?? (agg.set(t, { win: 0, draw: 0, loss: 0, total: 0 }), agg.get(t)!);

  for (const [matchId, byUser] of idx) {
    const m = matchOf.get(matchId);
    if (!m) continue;
    for (const p of byUser.values()) {
      const o = outcomeOf(p.pred_home, p.pred_away);
      const home = ensure(m.home_team);
      const away = ensure(m.away_team);
      home.total++;
      away.total++;
      if (o === "1") {
        home.win++;
        away.loss++;
      } else if (o === "2") {
        home.loss++;
        away.win++;
      } else {
        home.draw++;
        away.draw++;
      }
    }
  }

  const out: TeamConsensus[] = [];
  for (const [team, s] of agg) {
    if (s.total === 0) continue;
    const top = Math.max(s.win, s.draw, s.loss);
    // En qué está de acuerdo la mayoría: gana / empata / pierde.
    const topResult: TeamResult =
      s.win === top ? "win" : s.loss === top ? "loss" : "draw";
    out.push({
      team,
      win: s.win,
      draw: s.draw,
      loss: s.loss,
      agreement: top / s.total,
      topResult,
      total: s.total,
    });
  }
  return out;
}

/** Equipo con mayor unanimidad (todos opinan lo mismo de él). */
export function mostUnanimousTeam(
  preds: StatPrediction[],
  matches: StatMatch[]
): TeamConsensus | null {
  const list = teamConsensus(preds, matches).sort(
    (a, b) => b.agreement - a.agreement || b.total - a.total
  );
  return list[0] ?? null;
}

/** Equipo más polémico (máxima división de opiniones). */
export function mostDividedTeam(
  preds: StatPrediction[],
  matches: StatMatch[]
): TeamConsensus | null {
  const list = teamConsensus(preds, matches).sort(
    (a, b) => a.agreement - b.agreement || b.total - a.total
  );
  return list[0] ?? null;
}

/**
 * Equipo favorito de la peña: el que más victorias acumula en los pronósticos.
 * "Víctima": el que más derrotas acumula.
 */
export function favoriteAndVictim(
  preds: StatPrediction[],
  matches: StatMatch[]
): { favorite: { team: string; wins: number } | null; victim: { team: string; losses: number } | null } {
  const list = teamConsensus(preds, matches);
  let favorite: { team: string; wins: number } | null = null;
  let victim: { team: string; losses: number } | null = null;
  for (const t of list) {
    if (!favorite || t.win > favorite.wins) favorite = { team: t.team, wins: t.win };
    if (!victim || t.loss > victim.losses) victim = { team: t.team, losses: t.loss };
  }
  return { favorite, victim };
}

/** Media de goles por partido y % de empates de cada jugador. */
export function playerGoals(
  preds: StatPrediction[],
  users: StatUser[]
): PlayerGoals[] {
  const byUser = new Map<string, { goals: number; n: number; draws: number }>();
  for (const p of preds) {
    const e = byUser.get(p.user_id) ?? { goals: 0, n: 0, draws: 0 };
    e.goals += p.pred_home + p.pred_away;
    e.n++;
    if (p.pred_home === p.pred_away) e.draws++;
    byUser.set(p.user_id, e);
  }
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const out: PlayerGoals[] = [];
  for (const [uid, e] of byUser) {
    out.push({
      user: nameOf.get(uid) ?? "—",
      avgGoals: e.n ? e.goals / e.n : 0,
      drawPct: e.n ? (e.draws / e.n) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.avgGoals - a.avgGoals);
}

/** Marcador concreto más repetido por la peña. */
export function mostCommonScoreline(
  preds: StatPrediction[]
): { score: ScoreLine; count: number } | null {
  const counts = new Map<string, number>();
  for (const p of preds) {
    const key = `${p.pred_home}-${p.pred_away}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: { score: ScoreLine; count: number } | null = null;
  for (const [key, count] of counts) {
    if (!best || count > best.count) {
      const [h, a] = key.split("-").map(Number);
      best = { score: { home: h, away: a }, count };
    }
  }
  return best;
}

/**
 * Originalidad: para cada jugador, % de partidos en que su signo coincide con
 * el mayoritario. Menor % = más original/contrarian; mayor % = más gregario.
 */
export function originality(
  preds: StatPrediction[],
  matches: StatMatch[],
  users: StatUser[]
): Originality[] {
  const idx = indexPredictions(preds);
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const matchTop = new Map<number, Outcome>();
  for (const c of matchConsensus(preds, matches)) {
    matchTop.set(c.match.id, c.topOutcome);
  }
  const byUser = new Map<string, { aligned: number; n: number }>();
  for (const [matchId, top] of matchTop) {
    const byU = idx.get(matchId);
    if (!byU) continue;
    for (const p of byU.values()) {
      const e = byUser.get(p.user_id) ?? { aligned: 0, n: 0 };
      e.n++;
      if (outcomeOf(p.pred_home, p.pred_away) === top) e.aligned++;
      byUser.set(p.user_id, e);
    }
  }
  const out: Originality[] = [];
  for (const [uid, e] of byUser) {
    out.push({
      user: nameOf.get(uid) ?? "—",
      alignmentPct: e.n ? (e.aligned / e.n) * 100 : 0,
    });
  }
  return out.sort((a, b) => a.alignmentPct - b.alignmentPct); // más original primero
}
