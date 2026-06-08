import { requireProfile } from "@/lib/auth";
import MatchdayView, {
  type MatchdayMatch,
  type UserSlim,
  type PredictionSlim,
} from "@/components/MatchdayView";
import { loadMatchdayData } from "@/lib/loadMatchdayData";

export const dynamic = "force-dynamic";

export default async function JornadasPage({
  searchParams,
}: {
  searchParams: { demo?: string };
}) {
  const me = await requireProfile();

  // Modo demo (?demo=1): solo admin. Datos ficticios.
  const demoMode = searchParams?.demo === "1" && me.is_admin;
  if (demoMode) {
    return <DemoView meId={me.id} />;
  }

  const { matches, users, predictions, closedPhaseKeys } =
    await loadMatchdayData(me.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pronósticos por jornada</h1>
        <p className="text-sm text-slate-600">
          Verás los pronósticos de los demás cuando se cierre la fase. En fases
          abiertas, si ya enviaste el tuyo, también podrás ver el de quienes ya
          enviaron.
        </p>
      </div>

      <MatchdayView
        matches={matches}
        users={users}
        predictions={predictions}
        closedPhaseKeys={closedPhaseKeys}
        currentUserId={me.id}
      />
    </div>
  );
}

// ============================================================================
//  MODO DEMO con datos ficticios deterministas.
//  Genera 12 partidos repartidos en 3 jornadas y 5 jugadores ficticios con
//  pronósticos calculados a partir del match.id (estables entre recargas).
//  Nunca toca BD.
// ============================================================================
function DemoView({ meId }: { meId: string }) {
  const FAKE_USERS: UserSlim[] = [
    { id: "demo-a", display_name: "Alex (demo)" },
    { id: "demo-b", display_name: "Bea (demo)" },
    { id: "demo-c", display_name: "Carlos (demo)" },
    { id: "demo-d", display_name: "Diana (demo)" },
    { id: "demo-e", display_name: "Eva (demo)" },
  ];

  // 4 partidos por jornada × 3 jornadas = 12 partidos ficticios.
  const teamsByGroup: Record<string, [string, string]> = {
    A: ["Spain", "Brazil"],
    B: ["France", "Germany"],
    C: ["Argentina", "England"],
    D: ["Portugal", "Netherlands"],
  };
  const groupKeys = Object.keys(teamsByGroup);

  const matches: MatchdayMatch[] = [];
  let id = 1;
  for (let md = 1; md <= 3; md++) {
    for (const g of groupKeys) {
      const [home, away] = teamsByGroup[g];
      // En J1 todos pendientes; en J2 unos terminados; en J3 todos terminados.
      const finished = md >= 2;
      const homeScore = finished ? (id % 4) : null;
      const awayScore = finished ? ((id + 1) % 3) : null;
      matches.push({
        id,
        phase_key: "groups",
        phase_name: "Fase de grupos",
        matchday: md,
        group_label: g,
        home_team: home,
        away_team: away,
        kickoff: new Date(
          Date.now() + (md - 2) * 86400_000 + id * 3600_000
        ).toISOString(),
        home_score: homeScore,
        away_score: awayScore,
        status: finished ? "FINISHED" : "SCHEDULED",
      });
      id++;
    }
  }

  // Pronósticos ficticios: cada jugador inventa un marcador en función de su
  // letra + match.id (determinista).
  const predictions: PredictionSlim[] = [];
  for (const u of FAKE_USERS) {
    const seed = u.id.charCodeAt(u.id.length - 1); // a..e
    for (const m of matches) {
      const ph = (seed + m.id) % 4;
      const pa = (seed * 3 + m.id) % 3;
      let pts = 0;
      if (m.status === "FINISHED") {
        if (ph === m.home_score && pa === m.away_score) pts = 3;
        else if (
          (ph > pa && (m.home_score ?? 0) > (m.away_score ?? 0)) ||
          (ph < pa && (m.home_score ?? 0) < (m.away_score ?? 0)) ||
          (ph === pa && m.home_score === m.away_score)
        )
          pts = 1;
      }
      predictions.push({
        user_id: u.id,
        match_id: m.id,
        pred_home: ph,
        pred_away: pa,
        points_awarded: pts,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pronósticos por jornada</h1>
        <p className="text-sm text-slate-600">
          Verás los pronósticos de los demás cuando se cierre la fase.
        </p>
      </div>

      <div className="rounded-xl border border-purple-300 bg-purple-50 p-3 text-sm text-purple-900">
        <p className="font-semibold">🧪 Modo demo (solo admin)</p>
        <p className="mt-0.5 text-xs">
          Previsualización con <b>jugadores y pronósticos ficticios</b>. No se
          muestra ningún borrador real. Quita{" "}
          <code className="rounded bg-purple-100 px-1">?demo=1</code> de la URL
          para volver a la vista normal.
        </p>
      </div>

      <MatchdayView
        matches={matches}
        users={FAKE_USERS}
        predictions={predictions}
        closedPhaseKeys={["groups"]}
        currentUserId={meId /* no coincide con ninguno → todos aparecen como "otros" */}
      />
    </div>
  );
}
