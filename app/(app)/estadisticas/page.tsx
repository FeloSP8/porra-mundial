import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { Phase } from "@/lib/types";
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
  type StatUser,
} from "@/lib/stats";
import StatsView from "@/components/StatsView";

export const dynamic = "force-dynamic";

const MIN_SUBMITTED = 2;

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: { fase?: string };
}) {
  const me = await requireProfile();
  const supabase = createClient();

  const { data: phasesRaw } = await supabase
    .from("phases")
    .select("*")
    .neq("key", "bracket") // el cuadro tiene su propia naturaleza; stats por fase de partidos
    .order("order");
  const phases = (phasesRaw ?? []) as Phase[];

  // Fases que YO he enviado (solo esas puedo ver).
  const { data: mySubs } = await supabase
    .from("submissions")
    .select("phase_id")
    .eq("user_id", me.id);
  const mySubmittedPhaseIds = new Set((mySubs ?? []).map((s) => s.phase_id));
  const myPhases = phases.filter((p) => mySubmittedPhaseIds.has(p.id));

  // Fase seleccionada (por query ?fase=, o la primera que yo haya enviado).
  const selectedKey =
    searchParams?.fase && myPhases.some((p) => p.key === searchParams.fase)
      ? searchParams.fase
      : myPhases[0]?.key;
  const selectedPhase = phases.find((p) => p.key === selectedKey) ?? null;

  // Cabecera con selector de fases (solo las que he enviado).
  const header = (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">📈 Estadísticas</h1>
        <p className="text-sm text-slate-600">
          Curiosidades de los pronósticos de cada fase. Solo ves las
          estadísticas de las fases que tú ya has enviado.
        </p>
      </div>
      {myPhases.length > 0 && (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {myPhases.map((p) => (
              <Link
                key={p.id}
                href={`/estadisticas?fase=${p.key}`}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                  p.key === selectedKey
                    ? "bg-pitch text-white border-pitch shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Si no he enviado ninguna fase aún.
  if (!selectedPhase) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          Aún no has enviado ningún pronóstico. Cuando envíes una fase, aquí
          verás sus estadísticas (y las de quienes también la hayan enviado).
        </div>
      </div>
    );
  }

  // ¿Cuántos jugadores han enviado esta fase?
  const { data: phaseSubs } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("phase_id", selectedPhase.id);
  const submittedUserIds = (phaseSubs ?? []).map((s) => s.user_id);

  if (submittedUserIds.length < MIN_SUBMITTED) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border bg-white p-5 text-slate-600">
          Todavía no hay suficientes pronósticos enviados para mostrar
          estadísticas de <b>{selectedPhase.name}</b> (hace falta un mínimo de{" "}
          {MIN_SUBMITTED}; ahora mismo hay {submittedUserIds.length}).
        </div>
      </div>
    );
  }

  // Cargar partidos de la fase + pronósticos SOLO de los que han enviado.
  const { data: matchRows } = await supabase
    .from("matches")
    .select("id, home_team, away_team, group_label")
    .eq("phase_id", selectedPhase.id);
  const matches: StatMatch[] = (matchRows ?? []) as StatMatch[];
  const matchIds = matches.map((m) => m.id);

  const { data: predRows } = matchIds.length
    ? await supabase
        .from("predictions")
        .select("user_id, match_id, pred_home, pred_away")
        .in("match_id", matchIds)
        .in("user_id", submittedUserIds)
    : { data: [] as any[] };
  const preds = (predRows ?? []) as StatPrediction[];

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", submittedUserIds);
  const users: StatUser[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    name: p.display_name,
  }));

  // Computar todas las estadísticas en el servidor.
  const { favorite, victim } = favoriteAndVictim(preds, matches);
  const stats = {
    phaseName: selectedPhase.name,
    submittedCount: submittedUserIds.length,
    biggestWins: biggestWins(preds, matches, users, 3),
    mostAgreed: mostAgreedMatches(preds, matches, 3),
    mostDivided: mostDividedMatches(preds, matches, 3),
    unanimousTeam: mostUnanimousTeam(preds, matches),
    dividedTeam: mostDividedTeam(preds, matches),
    favorite,
    victim,
    playerGoals: playerGoals(preds, users),
    commonScore: mostCommonScoreline(preds),
    originality: originality(preds, matches, users),
  };

  return (
    <div className="space-y-4">
      {header}
      <StatsView stats={stats} />
    </div>
  );
}
