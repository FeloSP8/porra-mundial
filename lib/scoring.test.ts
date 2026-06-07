import { describe, it, expect } from "vitest";
import {
  matchPoints,
  groupOrderPoints,
  outcomeOf,
  SCORING,
} from "./scoring";

describe("outcomeOf", () => {
  it("detecta victoria local, empate y victoria visitante", () => {
    expect(outcomeOf(2, 0)).toBe("1");
    expect(outcomeOf(1, 1)).toBe("X");
    expect(outcomeOf(0, 3)).toBe("2");
  });
});

describe("matchPoints", () => {
  it("da puntos de marcador exacto", () => {
    expect(matchPoints({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(
      SCORING.EXACT_SCORE
    );
  });

  it("da puntos de solo resultado cuando acierta el signo pero no el marcador", () => {
    expect(matchPoints({ home: 3, away: 1 }, { home: 2, away: 0 })).toBe(
      SCORING.OUTCOME_ONLY
    );
  });

  it("acierta empate con marcador distinto = solo resultado", () => {
    expect(matchPoints({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe(
      SCORING.OUTCOME_ONLY
    );
  });

  it("da 0 cuando falla el signo", () => {
    expect(matchPoints({ home: 2, away: 0 }, { home: 0, away: 1 })).toBe(0);
  });

  it("da 0 si falta el pronóstico o el resultado real", () => {
    expect(matchPoints(null, { home: 1, away: 0 })).toBe(0);
    expect(matchPoints({ home: 1, away: 0 }, null)).toBe(0);
  });
});

describe("groupOrderPoints", () => {
  it("puntúa cada equipo bien colocado", () => {
    const predicted = { ESP: 1, BRA: 2, MEX: 3, GHA: 4 };
    const real = { ESP: 1, BRA: 2, GHA: 3, MEX: 4 };
    // ESP y BRA aciertan (2 equipos), MEX y GHA fallan
    expect(groupOrderPoints(predicted, real)).toBe(2 * SCORING.GROUP_POSITION);
  });

  it("da máximo cuando el orden es idéntico", () => {
    const order = { A: 1, B: 2, C: 3, D: 4 };
    expect(groupOrderPoints(order, order)).toBe(4 * SCORING.GROUP_POSITION);
  });

  it("da 0 cuando ningún equipo coincide", () => {
    const predicted = { A: 1, B: 2, C: 3, D: 4 };
    const real = { A: 4, B: 3, C: 2, D: 1 };
    expect(groupOrderPoints(predicted, real)).toBe(0);
  });
});
