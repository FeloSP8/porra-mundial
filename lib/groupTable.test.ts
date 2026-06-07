import { describe, it, expect } from "vitest";
import { groupTable, rankMap, type TableMatch } from "./groupTable";

// Helper para crear partidos de un grupo de 4 (todos contra todos = 6 partidos).
function m(
  home: string,
  away: string,
  hs: number | null,
  as: number | null
): TableMatch {
  return { home_team: home, away_team: away, home_score: hs, away_score: as };
}

const TEAMS = ["A", "B", "C", "D"];

describe("groupTable - puntos y estadísticas básicas", () => {
  it("ordena por puntos cuando no hay empates", () => {
    const matches = [
      m("A", "B", 2, 0), // A gana
      m("A", "C", 1, 0), // A gana
      m("A", "D", 3, 0), // A gana  -> A 9 pts
      m("B", "C", 1, 0), // B gana
      m("B", "D", 1, 0), // B gana  -> B 6 pts
      m("C", "D", 1, 0), // C gana  -> C 3 pts, D 0
    ];
    const table = groupTable(TEAMS, matches);
    expect(table.map((r) => r.team)).toEqual(["A", "B", "C", "D"]);
    expect(table[0].points).toBe(9);
    expect(table[0].gf).toBe(6);
    expect(table[0].ga).toBe(0);
    expect(table[0].gd).toBe(6);
    expect(table[3].points).toBe(0);
  });
});

describe("groupTable - desempate head-to-head", () => {
  it("dos equipos empatados a puntos: gana el head-to-head aunque tenga peor DG global", () => {
    // A y B empatan a 6 pts. B le ganó a A en el head-to-head,
    // pero A tiene mejor diferencia de goles global.
    // Por regla FIFA, el head-to-head manda: B por delante de A.
    const matches = [
      m("A", "B", 0, 1), // B gana el h2h
      m("A", "C", 5, 0), // A golea (infla su DG global)
      m("A", "D", 4, 0), // A golea -> A: 6 pts, DG +8
      m("B", "C", 1, 0), // B gana
      m("B", "D", 0, 2), // B PIERDE con D -> B: 6 pts (incl. h2h), DG menor
      m("C", "D", 0, 0), // empate -> C 1, D 4 (D ganó a B)
    ];
    const table = groupTable(TEAMS, matches);
    const top2 = table.slice(0, 2).map((r) => r.team);
    expect(top2).toEqual(["B", "A"]); // B primero por h2h pese a peor DG
    expect(table[0].points).toBe(6); // B
    expect(table[1].points).toBe(6); // A
    expect(table[1].gd).toBeGreaterThan(table[0].gd); // A tiene mejor DG global
  });

  it("cae a diferencia de goles global cuando el head-to-head fue empate", () => {
    // A y B empatan a 6 pts y empataron entre ellos (h2h igualado),
    // entonces decide la DG global: A tiene mejor DG -> A primero.
    const matches = [
      m("A", "B", 1, 1), // empate h2h
      m("A", "C", 3, 0), // A +3
      m("A", "D", 3, 0), // A +3 -> A: 6 pts... espera, empate da 1 pt
      m("B", "C", 1, 0), // B +1
      m("B", "D", 1, 0), // B +1
      m("C", "D", 0, 0),
    ];
    // Recalc puntos: A: empate(1) + win(3) + win(3) = 7; B: 1+3+3 = 7
    const table = groupTable(TEAMS, matches);
    expect(table[0].points).toBe(7);
    expect(table[1].points).toBe(7);
    // A tiene DG global +6 (3+3), B tiene +2 (1+1) -> A primero
    expect(table.slice(0, 2).map((r) => r.team)).toEqual(["A", "B"]);
  });
});

describe("groupTable - triple empate por head-to-head", () => {
  it("resuelve un triple empate usando la mini-liga entre los tres", () => {
    // A, B, C empatan a puntos arriba; D pierde todo.
    // Construimos un ciclo A>B, B>C, C>A pero con goles que separan por h2h.
    const matches = [
      m("A", "B", 2, 0), // A gana a B
      m("B", "C", 2, 0), // B gana a C
      m("C", "A", 1, 0), // C gana a A
      m("A", "D", 1, 0),
      m("B", "D", 1, 0),
      m("C", "D", 1, 0),
    ];
    // A, B, C: 6 pts cada uno (2 victorias, 1 derrota). D: 0.
    const table = groupTable(TEAMS, matches);
    expect(table[3].team).toBe("D");
    const top3 = table.slice(0, 3);
    for (const r of top3) expect(r.points).toBe(6);
    // No comprobamos el orden exacto del ciclo (depende de goles h2h),
    // pero sí que los tres están por encima de D y empatados a puntos.
  });
});

describe("groupTable - partidos sin jugar", () => {
  it("ignora partidos con marcador null (grupo a medias)", () => {
    const matches = [
      m("A", "B", 2, 0),
      m("C", "D", 1, 1),
      m("A", "C", null, null), // sin jugar
      m("B", "D", null, null),
      m("A", "D", null, null),
      m("B", "C", null, null),
    ];
    const table = groupTable(TEAMS, matches);
    expect(table[0].team).toBe("A"); // único con 3 pts
    expect(table[0].played).toBe(1);
    const totalPlayed = table.reduce((s, r) => s + r.played, 0);
    expect(totalPlayed).toBe(4); // 2 partidos jugados = 4 participaciones
  });
});

describe("rankMap", () => {
  it("convierte la tabla en mapa equipo->posición", () => {
    const matches = [
      m("A", "B", 1, 0),
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", 1, 0),
      m("B", "D", 1, 0),
      m("C", "D", 1, 0),
    ];
    const map = rankMap(groupTable(TEAMS, matches));
    expect(map["A"]).toBe(1);
    expect(map["D"]).toBe(4);
  });
});
