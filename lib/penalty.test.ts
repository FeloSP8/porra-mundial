import { describe, it, expect } from "vitest";
import { computePenalty, PENALTY_PER_MISSING } from "./recalc";

describe("computePenalty", () => {
  it("son 2 puntos por cada partido sin pronosticar", () => {
    expect(PENALTY_PER_MISSING).toBe(2);
  });

  it("no penaliza si lo rellenó todo", () => {
    expect(computePenalty(72, 72)).toEqual({ missing: 0, points: 0 });
  });

  it("penaliza solo los que faltan", () => {
    // 72 partidos, rellenó 60 → faltan 12 → -24
    expect(computePenalty(72, 60)).toEqual({ missing: 12, points: -24 });
  });

  it("penaliza todos si no rellenó ninguno", () => {
    expect(computePenalty(72, 0)).toEqual({ missing: 72, points: -144 });
  });

  it("nunca da penalización positiva (rellenó de más por datos raros)", () => {
    expect(computePenalty(10, 12)).toEqual({ missing: 0, points: 0 });
  });
});
