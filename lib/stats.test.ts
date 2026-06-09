import { describe, it, expect } from "vitest";
import {
  biggestWins,
  mostAgreedMatches,
  mostDividedMatches,
  mostUnanimousTeam,
  mostDividedTeam,
  favoriteAndVictim,
  playerGoals,
  mostCommonScoreline,
  originality,
  type StatMatch,
  type StatUser,
  type StatPrediction,
} from "./stats";

const users: StatUser[] = [
  { id: "u1", name: "Ana" },
  { id: "u2", name: "Bea" },
  { id: "u3", name: "Caro" },
];

const matches: StatMatch[] = [
  { id: 1, home_team: "Spain", away_team: "Brazil", group_label: "A" },
  { id: 2, home_team: "France", away_team: "Germany", group_label: "B" },
];

function P(
  user: string,
  match: number,
  h: number,
  a: number
): StatPrediction {
  return { user_id: user, match_id: match, pred_home: h, pred_away: a };
}

describe("biggestWins", () => {
  it("encuentra la mayor goleada y su autor", () => {
    const preds = [
      P("u1", 1, 5, 0), // dif 5
      P("u2", 1, 1, 0), // dif 1
      P("u3", 2, 2, 2), // dif 0
    ];
    const top = biggestWins(preds, matches, users, 1);
    expect(top[0].user).toBe("Ana");
    expect(top[0].diff).toBe(5);
    expect(top[0].score).toEqual({ home: 5, away: 0 });
  });
});

describe("consenso por partido", () => {
  it("detecta unanimidad y división", () => {
    const preds = [
      // Partido 1: todos local gana (unanimidad)
      P("u1", 1, 2, 0),
      P("u2", 1, 1, 0),
      P("u3", 1, 3, 1),
      // Partido 2: 1, X, 2 (máxima división)
      P("u1", 2, 2, 0),
      P("u2", 2, 1, 1),
      P("u3", 2, 0, 1),
    ];
    const agreed = mostAgreedMatches(preds, matches, 1)[0];
    expect(agreed.match.id).toBe(1);
    expect(agreed.agreement).toBe(1); // unanimidad

    const divided = mostDividedMatches(preds, matches, 1)[0];
    expect(divided.match.id).toBe(2);
    expect(divided.agreement).toBeCloseTo(1 / 3); // 1/X/2 repartido
  });
});

describe("consenso por equipo", () => {
  it("equipo más unánime y más polémico", () => {
    // Spain siempre gana (unánime); France 1/X/2 (polémico)
    const preds = [
      P("u1", 1, 2, 0),
      P("u2", 1, 1, 0),
      P("u3", 1, 3, 0),
      P("u1", 2, 2, 0), // France gana
      P("u2", 2, 1, 1), // empate
      P("u3", 2, 0, 2), // France pierde
    ];
    const unanimous = mostUnanimousTeam(preds, matches)!;
    // Spain: 3 victorias de 3 → agreement 1, y en lo que coinciden es "gana"
    expect(unanimous.team).toBe("Spain");
    expect(unanimous.agreement).toBe(1);
    expect(unanimous.topResult).toBe("win");

    const divided = mostDividedTeam(preds, matches)!;
    // France: 1 win, 1 draw, 1 loss → agreement 1/3
    expect(divided.team).toBe("France");
    expect(divided.agreement).toBeCloseTo(1 / 3);
  });
});

describe("favorito y víctima", () => {
  it("favorito = más victorias; víctima = más derrotas", () => {
    const preds = [
      P("u1", 1, 2, 0), // Spain gana, Brazil pierde
      P("u2", 1, 3, 0), // Spain gana, Brazil pierde
      P("u3", 1, 1, 0), // Spain gana, Brazil pierde
    ];
    const { favorite, victim } = favoriteAndVictim(preds, matches);
    expect(favorite!.team).toBe("Spain");
    expect(favorite!.wins).toBe(3);
    expect(victim!.team).toBe("Brazil");
    expect(victim!.losses).toBe(3);
  });
});

describe("playerGoals", () => {
  it("calcula media de goles y % de empates", () => {
    const preds = [
      P("u1", 1, 3, 1), // 4 goles, no empate
      P("u1", 2, 2, 2), // 4 goles, empate
    ];
    const g = playerGoals(preds, users).find((x) => x.user === "Ana")!;
    expect(g.avgGoals).toBe(4); // (4+4)/2
    expect(g.drawPct).toBe(50);
  });
});

describe("mostCommonScoreline", () => {
  it("encuentra el marcador más repetido", () => {
    const preds = [P("u1", 1, 1, 0), P("u2", 1, 1, 0), P("u3", 2, 2, 1)];
    const r = mostCommonScoreline(preds)!;
    expect(r.score).toEqual({ home: 1, away: 0 });
    expect(r.count).toBe(2);
  });
});

describe("originality", () => {
  it("el contrarian tiene menor alineamiento con el consenso", () => {
    const preds = [
      // Partido 1: mayoría local (u1,u2) vs visitante (u3)
      P("u1", 1, 2, 0),
      P("u2", 1, 1, 0),
      P("u3", 1, 0, 1),
      // Partido 2: mayoría local (u1,u2) vs empate (u3)
      P("u1", 2, 2, 0),
      P("u2", 2, 3, 1),
      P("u3", 2, 1, 1),
    ];
    const list = originality(preds, matches, users);
    // u3 (Caro) nunca coincide con el mayoritario → 0%, primera (más original)
    expect(list[0].user).toBe("Caro");
    expect(list[0].alignmentPct).toBe(0);
    // u1/u2 siempre con el mayoritario → 100%
    const ana = list.find((x) => x.user === "Ana")!;
    expect(ana.alignmentPct).toBe(100);
  });
});
