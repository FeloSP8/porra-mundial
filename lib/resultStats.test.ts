import { describe, it, expect } from "vitest";
import {
  playerAccuracy,
  exactScoreKing,
  bestNose,
  loneHits,
  topSeer,
  groupMastery,
  bracketLeaders,
  type StatUser,
  type ResultMatch,
  type Pred,
  type GroupPred,
  type GroupResultRow,
  type BracketRow,
} from "./resultStats";

const users: StatUser[] = [
  { id: "u1", name: "Ana" },
  { id: "u2", name: "Bea" },
  { id: "u3", name: "Caro" },
];

// Partidos terminados con resultado real.
const matches: ResultMatch[] = [
  // Spain 2-0 Brazil
  { id: 1, home_team: "Spain", away_team: "Brazil", group_label: "A", home_score: 2, away_score: 0 },
  // France 1-1 Germany
  { id: 2, home_team: "France", away_team: "Germany", group_label: "B", home_score: 1, away_score: 1 },
];

function P(user: string, match: number, h: number, a: number): Pred {
  return { user_id: user, match_id: match, pred_home: h, pred_away: a };
}

describe("playerAccuracy", () => {
  it("cuenta exactos, signos, puntos y precisión", () => {
    const preds = [
      P("u1", 1, 2, 0), // exacto → 3
      P("u1", 2, 0, 0), // signo X correcto pero no exacto → 1
      P("u2", 1, 1, 0), // signo 1 correcto, no exacto → 1
      P("u2", 2, 2, 0), // falla (real X, predijo 1) → 0
    ];
    const table = playerAccuracy(preds, matches, users);
    const ana = table.find((p) => p.user === "Ana")!;
    expect(ana.predicted).toBe(2);
    expect(ana.exact).toBe(1);
    expect(ana.outcomes).toBe(2);
    expect(ana.points).toBe(4); // 3 + 1
    expect(ana.accuracy).toBe(1);

    const bea = table.find((p) => p.user === "Bea")!;
    expect(bea.exact).toBe(0);
    expect(bea.outcomes).toBe(1);
    expect(bea.points).toBe(1);
    expect(bea.accuracy).toBe(0.5);

    // Ana va por delante de Bea (más puntos).
    expect(table[0].user).toBe("Ana");
  });

  it("excluye a quien no pronosticó partidos terminados", () => {
    const table = playerAccuracy([P("u1", 1, 2, 0)], matches, users);
    expect(table).toHaveLength(1);
    expect(table[0].user).toBe("Ana");
  });
});

describe("exactScoreKing / bestNose", () => {
  it("corona al rey del marcador exacto y al mejor olfato", () => {
    const preds = [
      P("u1", 1, 2, 0), // exacto
      P("u1", 2, 3, 1), // falla signo (real X) → 0
      P("u2", 1, 1, 0), // signo ok
      P("u2", 2, 0, 0), // signo ok
    ];
    const table = playerAccuracy(preds, matches, users);
    expect(exactScoreKing(table)!.user).toBe("Ana"); // 1 exacto

    // Bea acierta 2 de 2 signos (100%), Ana 1 de 2 (50%).
    expect(bestNose(table)!.user).toBe("Bea");
  });

  it("exactScoreKing devuelve null si nadie clava un exacto", () => {
    const preds = [P("u1", 1, 3, 1), P("u2", 1, 1, 0)];
    const table = playerAccuracy(preds, matches, users);
    expect(exactScoreKing(table)).toBeNull();
  });
});

describe("loneHits / topSeer", () => {
  it("detecta el acierto en solitario cuando los demás fallan", () => {
    // Partido 1 (Spain 2-0): u1 acierta signo, u2 y u3 fallan.
    const preds = [
      P("u1", 1, 1, 0), // signo 1 correcto
      P("u2", 1, 0, 1), // falla
      P("u3", 1, 1, 1), // falla (empate)
    ];
    const hits = loneHits(preds, matches, users, 3);
    expect(hits).toHaveLength(1);
    expect(hits[0].user).toBe("Ana");
    expect(hits[0].missed).toBe(2);
    expect(hits[0].exact).toBe(false);

    expect(topSeer(hits)!.user).toBe("Ana");
    expect(topSeer(hits)!.count).toBe(1);
  });

  it("no cuenta si aciertan dos, ni con menos de minVoters", () => {
    const dosAciertan = [
      P("u1", 1, 1, 0), // ok
      P("u2", 1, 2, 0), // ok (exacto)
      P("u3", 1, 0, 1), // falla
    ];
    expect(loneHits(dosAciertan, matches, users, 3)).toHaveLength(0);

    const pocos = [P("u1", 1, 1, 0), P("u2", 1, 0, 1)];
    expect(loneHits(pocos, matches, users, 3)).toHaveLength(0);
  });
});

describe("groupMastery", () => {
  const gres: GroupResultRow[] = [
    { group_label: "A", team: "Spain", rank: 1 },
    { group_label: "A", team: "Brazil", rank: 2 },
    { group_label: "A", team: "Japan", rank: 3 },
    { group_label: "A", team: "Egypt", rank: 4 },
  ];
  it("cuenta posiciones acertadas y grupos perfectos", () => {
    const gpreds: GroupPred[] = [
      // Ana: clava el grupo entero
      { user_id: "u1", group_label: "A", team: "Spain", predicted_rank: 1 },
      { user_id: "u1", group_label: "A", team: "Brazil", predicted_rank: 2 },
      { user_id: "u1", group_label: "A", team: "Japan", predicted_rank: 3 },
      { user_id: "u1", group_label: "A", team: "Egypt", predicted_rank: 4 },
      // Bea: 2 de 4
      { user_id: "u2", group_label: "A", team: "Spain", predicted_rank: 1 },
      { user_id: "u2", group_label: "A", team: "Brazil", predicted_rank: 2 },
      { user_id: "u2", group_label: "A", team: "Japan", predicted_rank: 4 },
      { user_id: "u2", group_label: "A", team: "Egypt", predicted_rank: 3 },
    ];
    const m = groupMastery(gpreds, gres, users);
    expect(m[0].user).toBe("Ana");
    expect(m[0].correct).toBe(4);
    expect(m[0].perfectGroups).toBe(1);
    const bea = m.find((x) => x.user === "Bea")!;
    expect(bea.correct).toBe(2);
    expect(bea.perfectGroups).toBe(0);
  });

  it("ignora grupos sin resultado", () => {
    const gpreds: GroupPred[] = [
      { user_id: "u1", group_label: "Z", team: "X", predicted_rank: 1 },
    ];
    expect(groupMastery(gpreds, gres, users)).toHaveLength(0);
  });
});

describe("bracketLeaders", () => {
  it("suma aciertos de avance y marca al que acierta el campeón", () => {
    const rows: BracketRow[] = [
      { user_id: "u1", round: "r16", team: "Spain", points: 1 },
      { user_id: "u1", round: "champion", team: "Spain", points: 1 },
      { user_id: "u2", round: "r16", team: "Brazil", points: 0 },
    ];
    const lb = bracketLeaders(rows, users);
    expect(lb[0].user).toBe("Ana");
    expect(lb[0].points).toBe(2);
    expect(lb[0].championHit).toBe(true);
    const bea = lb.find((x) => x.user === "Bea")!;
    expect(bea.points).toBe(0);
    expect(bea.championHit).toBe(false);
  });
});
