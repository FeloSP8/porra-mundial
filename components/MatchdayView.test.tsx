/**
 * Tests del componente MatchdayView.
 *
 * Verifican la lógica clave: ¿qué pronósticos se revelan, qué jornada se
 * selecciona por defecto, y cómo se muestran los puntos? No dependen de la BD.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MatchdayView, {
  type MatchdayMatch,
  type UserSlim,
  type PredictionSlim,
} from "./MatchdayView";

// useState/useMemo de un Server-rendered no son interactivos; renderizamos solo
// el estado inicial. defaultIndex elegirá la jornada de partida.

const USERS: UserSlim[] = [
  { id: "u1", display_name: "Felipe" },
  { id: "u2", display_name: "Óscar" },
];

function makeMatch(
  id: number,
  phase_key: string,
  matchday: number | null,
  daysFromNow: number,
  status: "SCHEDULED" | "FINISHED" = "SCHEDULED",
  scores: [number | null, number | null] = [null, null]
): MatchdayMatch {
  return {
    id,
    phase_key,
    phase_name: phase_key,
    matchday,
    group_label: "A",
    home_team: "Spain",
    away_team: "Brazil",
    kickoff: new Date(Date.now() + daysFromNow * 86400_000).toISOString(),
    home_score: scores[0],
    away_score: scores[1],
    status,
  };
}

describe("MatchdayView - revelado según fase cerrada", () => {
  it("NO muestra pronósticos cuando la fase está abierta", () => {
    const matches = [makeMatch(1, "groups", 1, 1)];
    const preds: PredictionSlim[] = [
      { user_id: "u1", match_id: 1, pred_home: 2, pred_away: 0, points_awarded: 0 },
    ];
    const html = renderToStaticMarkup(
      <MatchdayView
        matches={matches}
        users={USERS}
        predictions={preds}
        closedPhaseKeys={[]}
        currentUserId="u1"
      />
    );
    expect(html).toContain("Esta fase aún está abierta");
    // No debe aparecer el marcador del pronóstico en el HTML
    expect(html).not.toContain("2–0");
  });

  it("SÍ muestra pronósticos cuando la fase está cerrada", () => {
    const matches = [makeMatch(1, "groups", 1, 1)];
    const preds: PredictionSlim[] = [
      { user_id: "u1", match_id: 1, pred_home: 2, pred_away: 0, points_awarded: 0 },
      { user_id: "u2", match_id: 1, pred_home: 1, pred_away: 1, points_awarded: 0 },
    ];
    const html = renderToStaticMarkup(
      <MatchdayView
        matches={matches}
        users={USERS}
        predictions={preds}
        closedPhaseKeys={["groups"]}
        currentUserId="u1"
      />
    );
    expect(html).not.toContain("Esta fase aún está abierta");
    expect(html).toContain("2–0");
    expect(html).toContain("1–1");
  });

  it("Muestra los puntos cuando el partido ya terminó", () => {
    const matches = [makeMatch(1, "groups", 1, -1, "FINISHED", [2, 0])];
    const preds: PredictionSlim[] = [
      { user_id: "u1", match_id: 1, pred_home: 2, pred_away: 0, points_awarded: 3 },
      { user_id: "u2", match_id: 1, pred_home: 3, pred_away: 1, points_awarded: 1 },
    ];
    const html = renderToStaticMarkup(
      <MatchdayView
        matches={matches}
        users={USERS}
        predictions={preds}
        closedPhaseKeys={["groups"]}
        currentUserId="u1"
      />
    );
    expect(html).toContain("+3 pts");
    expect(html).toContain("+1 pts");
    expect(html).toContain("FINAL");
  });
});

describe("MatchdayView - jornada por defecto", () => {
  it("Selecciona la jornada en curso (con partidos no terminados)", () => {
    const matches = [
      // J1: todos terminados (pasados)
      makeMatch(1, "groups", 1, -10, "FINISHED", [1, 0]),
      makeMatch(2, "groups", 1, -10, "FINISHED", [1, 0]),
      // J2: hoy/mañana, no terminada
      makeMatch(3, "groups", 2, 0),
      makeMatch(4, "groups", 2, 1),
      // J3: futura
      makeMatch(5, "groups", 3, 5),
    ];
    const html = renderToStaticMarkup(
      <MatchdayView
        matches={matches}
        users={USERS}
        predictions={[]}
        closedPhaseKeys={["groups"]}
        currentUserId="u1"
      />
    );
    // La cabecera de la jornada activa debe ser la J2
    expect(html).toContain("Jornada 2");
    expect(html).not.toContain("Jornada 1 — Fase de");
  });

  it("Si todo está terminado, selecciona la última", () => {
    const matches = [
      makeMatch(1, "groups", 1, -10, "FINISHED", [1, 0]),
      makeMatch(2, "groups", 2, -5, "FINISHED", [2, 1]),
      makeMatch(3, "groups", 3, -1, "FINISHED", [0, 0]),
    ];
    const html = renderToStaticMarkup(
      <MatchdayView
        matches={matches}
        users={USERS}
        predictions={[]}
        closedPhaseKeys={["groups"]}
        currentUserId="u1"
      />
    );
    expect(html).toContain("Jornada 3");
  });
});
