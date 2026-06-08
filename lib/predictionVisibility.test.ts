/**
 * Tests del filtro de visibilidad de pronósticos.
 *
 * La seguridad de la app depende de que estos pasen: garantizan que ningún
 * pronóstico ajeno viaja al cliente cuando no debería.
 */
import { describe, it, expect } from "vitest";
import {
  filterVisiblePredictions,
  type PredictionRow,
  type FilterContext,
} from "./predictionVisibility";

// Escenario base: una fase "groups" (id=1) y los matches 100,101 le pertenecen.
function ctx(over: Partial<FilterContext> = {}): FilterContext {
  return {
    currentUserId: "me",
    phaseKeyOfMatch: new Map([
      [100, "groups"],
      [101, "groups"],
    ]),
    phaseIdOfMatch: new Map([
      [100, 1],
      [101, 1],
    ]),
    closedPhaseKeys: new Set(),
    mySubmittedPhaseIds: new Set(),
    submittedByPhase: new Map(),
    ...over,
  };
}

const P = (user: string, match: number): PredictionRow => ({
  user_id: user,
  match_id: match,
  pred_home: 1,
  pred_away: 0,
  points_awarded: 0,
});

describe("filterVisiblePredictions - reglas básicas", () => {
  it("Siempre veo los míos, esté como esté la fase", () => {
    const preds = [P("me", 100), P("me", 101)];
    const out = filterVisiblePredictions(preds, ctx());
    expect(out).toHaveLength(2);
  });

  it("Fase cerrada: TODOS los pronósticos son visibles", () => {
    const preds = [P("me", 100), P("a", 100), P("b", 101)];
    const out = filterVisiblePredictions(
      preds,
      ctx({ closedPhaseKeys: new Set(["groups"]) })
    );
    expect(out).toHaveLength(3);
  });
});

describe("filterVisiblePredictions - fase abierta y privacidad", () => {
  it("Fase abierta y YO no envié: NO veo nada de los demás (críticamente)", () => {
    const preds = [
      P("me", 100),
      P("a", 100), // a ya envió
      P("b", 100), // b no envió
    ];
    const out = filterVisiblePredictions(
      preds,
      ctx({
        mySubmittedPhaseIds: new Set(), // yo NO envié
        submittedByPhase: new Map([[1, new Set(["a"])]]),
      })
    );
    // Solo el mío
    expect(out).toHaveLength(1);
    expect(out[0].user_id).toBe("me");
  });

  it("Fase abierta y YO sí envié: veo los míos + los de quienes también enviaron", () => {
    const preds = [
      P("me", 100),
      P("a", 100), // a envió → debería verse
      P("b", 100), // b no envió → NO se ve
      P("c", 101), // c envió → se ve
    ];
    const out = filterVisiblePredictions(
      preds,
      ctx({
        mySubmittedPhaseIds: new Set([1]),
        submittedByPhase: new Map([[1, new Set(["me", "a", "c"])]]),
      })
    );
    const users = out.map((p) => p.user_id).sort();
    expect(users).toEqual(["a", "c", "me"]);
  });

  it("Si la fase está cerrada, los envíos no importan: se ve todo", () => {
    const preds = [P("me", 100), P("a", 100), P("b", 100)];
    const out = filterVisiblePredictions(
      preds,
      ctx({
        closedPhaseKeys: new Set(["groups"]),
        mySubmittedPhaseIds: new Set(), // yo no envié pero la fase está cerrada
        submittedByPhase: new Map(),
      })
    );
    expect(out).toHaveLength(3);
  });
});

describe("filterVisiblePredictions - mezcla de fases", () => {
  it("Se aplica fase a fase: una cerrada y otra abierta a la vez", () => {
    const c: FilterContext = {
      currentUserId: "me",
      phaseKeyOfMatch: new Map([
        [100, "groups"], // cerrada
        [200, "r32"], // abierta
      ]),
      phaseIdOfMatch: new Map([
        [100, 1],
        [200, 2],
      ]),
      closedPhaseKeys: new Set(["groups"]),
      mySubmittedPhaseIds: new Set([1]), // grupos enviada
      submittedByPhase: new Map([
        [1, new Set(["me", "a"])],
        [2, new Set(["a"])], // en r32: solo "a" envió; yo NO
      ]),
    };
    const preds = [
      P("a", 100), // groups (cerrada) → visible
      P("a", 200), // r32 (abierta, yo no envié) → NO visible
      P("me", 200), // mío → visible
    ];
    const out = filterVisiblePredictions(preds, c);
    const tuples = out.map((p) => `${p.user_id}-${p.match_id}`).sort();
    expect(tuples).toEqual(["a-100", "me-200"]);
  });
});

describe("filterVisiblePredictions - higiénico", () => {
  it("Predicciones sin match conocido (datos inconsistentes) se filtran", () => {
    const preds = [P("a", 999)];
    const out = filterVisiblePredictions(preds, ctx());
    expect(out).toHaveLength(0);
  });
});
