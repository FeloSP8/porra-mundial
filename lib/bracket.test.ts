import { describe, it, expect } from "vitest";
import {
  buildR32FromGroups,
  R32_MATCHES,
  ROUND_SIZES,
  nextRound,
  slotId,
} from "./bracket";

// Genera un orden de grupos de juguete: cada grupo A..L con 4 equipos
// nombrados "<G>1".."<G>4" (1º..4º).
function fakeGroups(): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const g of "ABCDEFGHIJKL".split("")) {
    groups[g] = [`${g}1`, `${g}2`, `${g}3`, `${g}4`];
  }
  return groups;
}

describe("estructura del bracket", () => {
  it("tiene 16 cruces en R32", () => {
    expect(R32_MATCHES).toHaveLength(16);
  });

  it("cubre cada posición exactamente una vez (sin duplicados ni huecos)", () => {
    const groups = "ABCDEFGHIJKL".split("");
    const winners: Record<string, number> = {};
    const runners: Record<string, number> = {};
    let thirds = 0;
    for (const m of R32_MATCHES) {
      for (const s of [m.home, m.away]) {
        if (s.type === "winner") winners[s.group] = (winners[s.group] ?? 0) + 1;
        else if (s.type === "runnerup")
          runners[s.group] = (runners[s.group] ?? 0) + 1;
        else thirds++;
      }
    }
    // Cada uno de los 12 ganadores y 12 segundos aparece EXACTAMENTE una vez.
    for (const g of groups) {
      expect(winners[g], `ganador grupo ${g}`).toBe(1);
      expect(runners[g], `segundo grupo ${g}`).toBe(1);
    }
    // Y exactamente 8 slots de tercero.
    expect(thirds).toBe(8);
  });

  it("genera 32 equipos sin ninguno repetido (con un orden de grupos válido)", () => {
    const r32 = buildR32FromGroups(fakeGroups());
    const teams: string[] = [];
    for (const m of R32_MATCHES) {
      if (r32[m.id].home) teams.push(r32[m.id].home!);
      if (r32[m.id].away) teams.push(r32[m.id].away!);
    }
    expect(teams).toHaveLength(32);
    expect(new Set(teams).size).toBe(32); // ← cero duplicados
  });

  it("los tamaños de ronda forman un árbol que reduce a la mitad", () => {
    expect(ROUND_SIZES).toEqual({ r32: 16, r16: 8, qf: 4, sf: 2, final: 1 });
  });

  it("nextRound encadena las rondas correctamente", () => {
    expect(nextRound("r32")).toBe("r16");
    expect(nextRound("r16")).toBe("qf");
    expect(nextRound("sf")).toBe("final");
    expect(nextRound("final")).toBe("champion");
    expect(nextRound("champion")).toBe(null);
  });

  it("slotId genera ids estables", () => {
    expect(slotId("r32", 0)).toBe("r32-1");
    expect(slotId("r16", 2)).toBe("r16-3");
    expect(slotId("final", 0)).toBe("final");
    expect(slotId("champion", 0)).toBe("champion");
  });
});

describe("buildR32FromGroups", () => {
  it("coloca ganadores y segundos de grupo en sus slots (bracket oficial)", () => {
    const r32 = buildR32FromGroups(fakeGroups());
    // r32-1 = M74: ganador E vs un tercero
    expect(r32["r32-1"].home).toBe("E1");
    // r32-3 = M73: segundo A vs segundo B
    expect(r32["r32-3"].home).toBe("A2");
    expect(r32["r32-3"].away).toBe("B2");
    // r32-4 = M75: ganador F vs segundo C
    expect(r32["r32-4"].home).toBe("F1");
    expect(r32["r32-4"].away).toBe("C2");
    // r32-5 = M76: ganador C vs segundo F
    expect(r32["r32-5"].home).toBe("C1");
    expect(r32["r32-5"].away).toBe("F2");
  });

  it("rellena los slots de tercero con 8 equipos distintos", () => {
    const r32 = buildR32FromGroups(fakeGroups());
    const thirds: string[] = [];
    for (const m of R32_MATCHES) {
      const home = r32[m.id].home;
      const away = r32[m.id].away;
      if (m.home.type === "third" && home) thirds.push(home);
      if (m.away.type === "third" && away) thirds.push(away);
    }
    // Debe haber exactamente 8 slots de tercero, todos distintos y terminando en "3".
    expect(thirds).toHaveLength(8);
    expect(new Set(thirds).size).toBe(8);
    for (const t of thirds) expect(t.endsWith("3")).toBe(true);
  });

  it("usa thirdsStats para elegir los 8 mejores terceros", () => {
    const groups = fakeGroups();
    // Damos muchos puntos a los terceros de A..H y pocos a I..L → deben pasar A..H.
    const stats: Record<string, { points: number; gd: number; gf: number }> = {};
    for (const g of "ABCDEFGH".split(""))
      stats[`${g}3`] = { points: 9, gd: 9, gf: 9 };
    for (const g of "IJKL".split(""))
      stats[`${g}3`] = { points: 0, gd: 0, gf: 0 };

    const r32 = buildR32FromGroups(groups, stats);
    const thirds = new Set<string>();
    for (const m of R32_MATCHES) {
      if (m.home.type === "third" && r32[m.id].home) thirds.add(r32[m.id].home!);
      if (m.away.type === "third" && r32[m.id].away) thirds.add(r32[m.id].away!);
    }
    // Los terceros de I,J,K,L NO deben aparecer.
    for (const g of "IJKL".split("")) expect(thirds.has(`${g}3`)).toBe(false);
    // Los de A..H sí.
    for (const g of "ABCDEFGH".split("")) expect(thirds.has(`${g}3`)).toBe(true);
  });
});
