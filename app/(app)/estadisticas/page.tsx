import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  playerAccuracy,
  exactScoreKing,
  bestNose,
  loneHits,
  topSeer,
  groupMastery,
  bracketStats,
  type ResultMatch,
  type Pred,
  type StatUser,
  type GroupPred,
  type GroupResultRow,
  type BracketRow,
} from "@/lib/resultStats";
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
  type StatPrediction,
} from "@/lib/predictionStats";
import StatsView from "@/components/StatsView";
import PredictionStatsView from "@/components/PredictionStatsView";

export const dynamic = "force-dynamic";

export default async function EstadisticasPage() {
  const me = await requireProfile();
  const supabase = createClient();

  const header = (
    <div>
      <h1 className="text-2xl font-bold">📈 Estadísticas</h1>
      <p className="text-sm text-slate-600">
        Aciertos sobre lo ya jugado y lo que pronostica la peña en la próxima
        ronda.
      </p>
    </div>
  );

  // Todos los partidos (para resultados a 90' y para la realidad del cuadro).
  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "id, phase_id, stage, home_team, away_team, group_label, home_score, away_score, status, winner"
    );
  const allMatches = matchRows ?? [];

  // Partidos YA jugados, con resultado real (a los 90'), para los aciertos.
  const matches: ResultMatch[] = allMatches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        m.home_score !== null &&
        m.away_score !== null
    )
    .map((m) => ({
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      group_label: m.group_label,
      home_score: m.home_score as number,
      away_score: m.away_score as number,
    }));

  if (matches.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          Todavía no hay partidos jugados. En cuanto haya resultados, aquí
          aparecerán las estadísticas de aciertos.
        </div>
      </div>
    );
  }

  const matchIds = matches.map((m) => m.id);

  // Pronósticos de esos partidos (ya públicos al estar jugados).
  const { data: predRows } = await supabase
    .from("predictions")
    .select("user_id, match_id, pred_home, pred_away")
    .in("match_id", matchIds);
  const preds = (predRows ?? []) as Pred[];

  // Nombres de jugadores.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name");
  const users: StatUser[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
  }));

  // Clasificación real de los grupos + pronósticos de orden.
  const { data: groupResultRows } = await supabase
    .from("group_results")
    .select("group_label, team, rank");
  const groupResults = (groupResultRows ?? []) as GroupResultRow[];

  const { data: groupPredRows } = await supabase
    .from("group_standings_predictions")
    .select("user_id, group_label, team, predicted_rank");
  const groupPreds = (groupPredRows ?? []) as GroupPred[];

  // Cuadro: picks de cada jugador (el equipo que hizo ganar cada cruce).
  const { data: bracketRows } = await supabase
    .from("bracket_predictions")
    .select("user_id, round, team");
  const bracket: BracketRow[] = (bracketRows ?? []) as BracketRow[];

  // Realidad del cuadro: equipos que alcanzaron cada ronda KO + eliminados.
  const STAGE_TO_TARGET: Record<string, string> = {
    LAST_16: "r16",
    QUARTER_FINALS: "qf",
    SEMI_FINALS: "sf",
    FINAL: "final",
  };
  const realByRound: Record<string, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(),
    champion: new Set(),
  };
  const eliminated = new Set<string>();
  for (const m of allMatches) {
    const target = m.stage ? STAGE_TO_TARGET[m.stage] : undefined;
    if (target) {
      if (m.home_team) realByRound[target].add(m.home_team);
      if (m.away_team) realByRound[target].add(m.away_team);
    }
    // Campeón = ganador real de la final terminada.
    if (m.stage === "FINAL" && m.status === "FINISHED") {
      if (m.winner === "HOME_TEAM") realByRound.champion.add(m.home_team);
      else if (m.winner === "AWAY_TEAM") realByRound.champion.add(m.away_team);
    }
    // Eliminados: el perdedor de cualquier cruce KO terminado.
    const isKO = m.stage && m.stage !== "GROUP_STAGE";
    if (isKO && m.status === "FINISHED") {
      if (m.winner === "HOME_TEAM") eliminated.add(m.away_team);
      else if (m.winner === "AWAY_TEAM") eliminated.add(m.home_team);
    }
  }

  // --- Cálculos ---
  const players = playerAccuracy(preds, matches, users);
  const maxPredicted = players[0]
    ? Math.max(...players.map((p) => p.predicted))
    : 0;
  // Para el "mejor olfato" exigimos una muestra mínima (la mitad del máximo).
  const minPredicted = Math.max(1, Math.ceil(maxPredicted / 2));

  const hits = loneHits(preds, matches, users, 3);
  const groupMasters = groupMastery(groupPreds, groupResults, users);
  const bracket_ = bracketStats(bracket, users, realByRound, eliminated);

  const stats = {
    finishedCount: matches.length,
    players,
    exactKing: exactScoreKing(players),
    bestNose: bestNose(players, minPredicted),
    seer: topSeer(hits),
    topGroupMaster: groupMasters[0] ?? null,
    topBracket: bracket_[0] ?? null,
    loneHits: hits.slice(0, 8),
    groupMasters,
    bracket: bracket_,
  };

  // ---------------------------------------------------------------------------
  //  Consenso de la PRÓXIMA ronda ya enviada pero aún sin jugar (p.ej. octavos).
  //  Privacidad: solo se muestra si YO la he enviado, y se calcula sobre quienes
  //  también la han enviado.
  // ---------------------------------------------------------------------------
  const predictionStats = await buildPredictionStats(
    supabase,
    me.id,
    allMatches,
    users
  );

  return (
    <div className="space-y-6">
      {header}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🎯 Aciertos (fases ya jugadas)</h2>
        <StatsView stats={stats} />
      </section>

      {predictionStats && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            🔮 Predicciones de {predictionStats.phaseName}
          </h2>
          <PredictionStatsView stats={predictionStats} />
        </section>
      )}
    </div>
  );
}

/**
 * Estadísticas de consenso de la primera ronda de partidos (por orden) que
 * cumple: tiene partidos, ninguno se ha jugado aún, el usuario actual la ha
 * enviado y hay al menos 2 envíos. Devuelve null si no hay ninguna.
 */
async function buildPredictionStats(
  supabase: ReturnType<typeof createClient>,
  myId: string,
  allMatches: any[],
  users: StatUser[]
) {
  const { data: phaseRows } = await supabase
    .from("phases")
    .select("id, key, name, order")
    .neq("key", "bracket")
    .order("order");
  const phases = phaseRows ?? [];

  const { data: subRows } = await supabase
    .from("submissions")
    .select("user_id, phase_id");
  const submittedByPhase = new Map<number, Set<string>>();
  for (const s of subRows ?? []) {
    if (!submittedByPhase.has(s.phase_id))
      submittedByPhase.set(s.phase_id, new Set());
    submittedByPhase.get(s.phase_id)!.add(s.user_id);
  }

  // Partidos por fase.
  const byPhase = new Map<number, any[]>();
  for (const m of allMatches) {
    if (!byPhase.has(m.phase_id)) byPhase.set(m.phase_id, []);
    byPhase.get(m.phase_id)!.push(m);
  }

  // Primera fase (por orden) sin jugar, que yo he enviado y con >= 2 envíos.
  const target = phases.find((p) => {
    const ms = byPhase.get(p.id) ?? [];
    if (ms.length === 0) return false;
    const nonesPlayed = ms.every((m) => m.status !== "FINISHED");
    const submitters = submittedByPhase.get(p.id) ?? new Set<string>();
    return nonesPlayed && submitters.has(myId) && submitters.size >= 2;
  });
  if (!target) return null;

  const submitters = [...(submittedByPhase.get(target.id) ?? new Set())];
  const phaseMatches: StatMatch[] = (byPhase.get(target.id) ?? []).map((m) => ({
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    group_label: m.group_label,
  }));
  const phaseMatchIds = phaseMatches.map((m) => m.id);

  const { data: predRows } = phaseMatchIds.length
    ? await supabase
        .from("predictions")
        .select("user_id, match_id, pred_home, pred_away")
        .in("match_id", phaseMatchIds)
        .in("user_id", submitters)
    : { data: [] as any[] };
  const phasePreds = (predRows ?? []) as StatPrediction[];

  const { favorite, victim } = favoriteAndVictim(phasePreds, phaseMatches);
  return {
    phaseName: target.name,
    submittedCount: submitters.length,
    biggestWins: biggestWins(phasePreds, phaseMatches, users, 3),
    mostAgreed: mostAgreedMatches(phasePreds, phaseMatches, 3),
    mostDivided: mostDividedMatches(phasePreds, phaseMatches, 3),
    unanimousTeam: mostUnanimousTeam(phasePreds, phaseMatches),
    dividedTeam: mostDividedTeam(phasePreds, phaseMatches),
    favorite,
    victim,
    playerGoals: playerGoals(phasePreds, users),
    commonScore: mostCommonScoreline(phasePreds),
    originality: originality(phasePreds, phaseMatches, users),
  };
}
