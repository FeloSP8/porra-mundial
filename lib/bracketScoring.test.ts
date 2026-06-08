import { describe, it, expect } from "vitest";
import { bracketPoints, bracketTotal } from "./bracketScoring";

describe("bracketPoints", () => {
  it("da 1 punto por cada ganador de cruce acertado", () => {
    const predicted = {
      "r32-1": "España",
      "r32-2": "Brasil",
      "r16-1": "España",
      champion: "España",
    };
    const real = {
      "r32-1": "España", // acierto
      "r32-2": "Argentina", // fallo
      "r16-1": "España", // acierto
      champion: "Francia", // fallo
    };
    const pts = bracketPoints(predicted, real);
    expect(pts["r32-1"]).toBe(1);
    expect(pts["r32-2"]).toBe(0);
    expect(pts["r16-1"]).toBe(1);
    expect(pts["champion"]).toBe(0);
  });

  it("solo puntúa los slots con resultado real", () => {
    const predicted = { "r32-1": "España", "r32-2": "Brasil" };
    const real = { "r32-1": "España" }; // r32-2 aún sin jugar
    const pts = bracketPoints(predicted, real);
    expect(Object.keys(pts)).toEqual(["r32-1"]);
    expect(pts["r32-1"]).toBe(1);
  });

  it("da 0 si el jugador no pronosticó ese slot", () => {
    const predicted = {};
    const real = { "r32-1": "España" };
    expect(bracketPoints(predicted, real)["r32-1"]).toBe(0);
  });

  it("el campeón también vale 1 punto", () => {
    expect(
      bracketPoints({ champion: "España" }, { champion: "España" })["champion"]
    ).toBe(1);
  });
});

describe("bracketTotal", () => {
  it("suma todos los aciertos", () => {
    const predicted = {
      "r32-1": "A",
      "r32-2": "B",
      "r16-1": "A",
      sf: "A",
      final: "A",
      champion: "A",
    };
    const real = {
      "r32-1": "A", // 1
      "r32-2": "X", // 0
      "r16-1": "A", // 1
      sf: "A", // 1
      final: "A", // 1
      champion: "A", // 1
    };
    expect(bracketTotal(predicted, real)).toBe(5);
  });
});
