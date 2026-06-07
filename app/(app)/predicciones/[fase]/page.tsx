import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase, type Match } from "@/lib/types";
import { PHASE_KEYS } from "@/lib/constants";
import PredictionForm from "@/components/PredictionForm";

export default async function FasePage({
  params,
}: {
  params: { fase: string };
}) {
  const phaseKey = params.fase;
  if (!PHASE_KEYS.includes(phaseKey as any)) notFound();

  const profile = await requireProfile();
  const supabase = createClient();

  const { data: phase } = await supabase
    .from("phases")
    .select("*")
    .eq("key", phaseKey)
    .single<Phase>();
  if (!phase) notFound();

  const { data: matchesData } = await supabase
    .from("matches")
    .select("*")
    .eq("phase_id", phase.id)
    .order("group_label", { nullsFirst: false })
    .order("kickoff", { nullsFirst: false });
  const matches = (matchesData ?? []) as Match[];

  // ¿ya envió?
  const { data: sub } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", profile.id)
    .eq("phase_id", phase.id)
    .maybeSingle();
  const alreadySubmitted = !!sub;

  // pronósticos previos (borrador o enviado)
  const matchIds = matches.map((m) => m.id);
  const { data: preds } = matchIds.length
    ? await supabase
        .from("predictions")
        .select("match_id, pred_home, pred_away")
        .eq("user_id", profile.id)
        .in("match_id", matchIds)
    : { data: [] as any[] };

  const isGroupPhase = phase.key === "groups";

  // equipos por grupo (a partir de los partidos del grupo)
  const groupsTeams: Record<string, string[]> = {};
  if (isGroupPhase) {
    for (const m of matches) {
      if (!m.group_label) continue;
      const set = new Set(groupsTeams[m.group_label] ?? []);
      set.add(m.home_team);
      set.add(m.away_team);
      groupsTeams[m.group_label] = Array.from(set).sort();
    }
  }

  const readOnly = alreadySubmitted || !phaseAcceptsSubmissions(phase);

  if (matches.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-bold">{phase.name}</h1>
        <p className="mt-2 text-slate-600">
          Aún no hay partidos cargados para esta fase. El organizador los
          cargará cuando se conozcan los emparejamientos.
        </p>
      </div>
    );
  }

  return (
    <PredictionForm
      phaseKey={phase.key}
      phaseName={phase.name}
      matches={matches}
      isGroupPhase={isGroupPhase}
      groupsTeams={groupsTeams}
      initialPredictions={preds ?? []}
      readOnly={readOnly}
      alreadySubmitted={alreadySubmitted}
    />
  );
}
