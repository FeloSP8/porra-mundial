import { describe, it, expect } from "vitest";
import {
  bracketPoints,
  bracketTotal,
  bracketPointsByRound,
  type RoundKey,
} from "./bracketScoring";

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

describe("bracketPointsByRound (la que usa el recálculo real)", () => {
  // Helper para construir el mapa ronda -> Set<equipo>.
  function rounds(
    obj: Partial<Record<RoundKey, string[]>>
  ): Record<RoundKey, Set<string>> {
    return {
      r16: new Set(obj.r16 ?? []),
      qf: new Set(obj.qf ?? []),
      sf: new Set(obj.sf ?? []),
      final: new Set(obj.final ?? []),
      champion: new Set(obj.champion ?? []),
    };
  }

  it("puntúa por RONDA ALCANZADA, sin importar el lado del cuadro", () => {
    // El jugador predijo que España llega a la final. España llega de verdad,
    // aunque por el otro lado del cuadro (eso es irrelevante: solo cuenta que
    // está entre los equipos que alcanzaron la final).
    const predicted = rounds({ final: ["España"] });
    const real = rounds({ final: ["España", "Francia"] });
    const { total, perRound } = bracketPointsByRound(predicted, real);
    expect(perRound.final).toBe(1);
    expect(total).toBe(1);
  });

  it("cuenta cada ronda por separado y suma", () => {
    const predicted = rounds({
      r16: ["España", "Brasil"],
      qf: ["España"],
      sf: ["España"],
      final: ["España"],
      champion: ["España"],
    });
    const real = rounds({
      r16: ["España", "Italia"], // España sí (1), Brasil no
      qf: ["España"], // 1
      sf: ["Francia"], // España no (0)
      final: ["España"], // 1
      champion: ["España"], // 1
    });
    const { total, perRound } = bracketPointsByRound(predicted, real);
    expect(perRound.r16).toBe(1);
    expect(perRound.qf).toBe(1);
    expect(perRound.sf).toBe(0);
    expect(perRound.final).toBe(1);
    expect(perRound.champion).toBe(1);
    expect(total).toBe(4);
  });

  it("no puntúa rondas aún no jugadas (sets reales vacíos)", () => {
    const predicted = rounds({ final: ["España"], champion: ["España"] });
    const real = rounds({}); // nada jugado todavía
    expect(bracketPointsByRound(predicted, real).total).toBe(0);
  });
});
