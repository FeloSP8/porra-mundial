import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import { groupTable, rankMap, type TableMatch } from "@/lib/groupTable";
import { groupOrderPoints } from "@/lib/scoring";
import GroupsView, {
  type GroupBlock,
  type PlayerSlim,
} from "@/components/GroupsView";

export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const me = await requireProfile();
  const supabase = createClient();

  // Fases.
  const { data: phasesRaw } = await supabase.from("phases").select("*");
  const phases = (phasesRaw ?? []) as Phase[];
  const groupsPhase = phases.find((p) => p.key === "groups");
  if (!groupsPhase) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-bold">Grupos</h1>
        <p className="mt-2 text-slate-600">Aún no hay fase de grupos.</p>
      </div>
    );
  }

  // Privacidad: solo quien ENVIÓ la fase de grupos puede ver esta vista
  // (igual que el resto de pronósticos). Como la fase suele estar ya cerrada,
  // todos los que enviaron la ven.
  const { data: subsRaw } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("phase_id", groupsPhase.id);
  const submittedSet = new Set((subsRaw ?? []).map((s) => s.user_id));
  const bracketClosed = !phaseAcceptsSubmissions(groupsPhase);
  const canView = bracketClosed || submittedSet.has(me.id);

  if (!canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">📊 Grupos</h1>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          Podrás ver las predicciones de grupos de todos cuando envíes el tuyo o
          se cierre la fase.
        </div>
      </div>
    );
  }

  // Partidos de la fase de grupos (con resultados ya guardados en la BD).
  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "id, group_label, home_team, away_team, home_score, away_score, status"
    )
    .eq("phase_id", groupsPhase.id)
    .not("group_label", "is", null);

  // Jugadores y sus predicciones de orden de grupo.
  const [{ data: profilesRaw }, { data: gspRaw }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").order("display_name"),
    supabase
      .from("group_standings_predictions")
      .select("user_id, group_label, team, predicted_rank")
      .eq("phase_id", groupsPhase.id),
  ]);
  const players = (profilesRaw ?? []) as PlayerSlim[];

  // Solo se computan/muestran las predicciones de quienes han enviado grupos.
  const visiblePlayers = players.filter(
    (p) => bracketClosed || submittedSet.has(p.id)
  );
  const visibleIds = new Set(visiblePlayers.map((p) => p.id));

  // Agrupar partidos por grupo y construir TableMatch[] con los resultados.
  const byGroup: Record<
    string,
    { teams: Set<string>; matches: TableMatch[] }
  > = {};
  for (const m of matchRows ?? []) {
    const g = (byGroup[m.group_label!] ??= { teams: new Set(), matches: [] });
    g.teams.add(m.home_team);
    g.teams.add(m.away_team);
    g.matches.push({
      home_team: m.home_team,
      away_team: m.away_team,
      // Solo cuentan los partidos FINISHED para la clasificación "al día".
      home_score: m.status === "FINISHED" ? m.home_score : null,
      away_score: m.status === "FINISHED" ? m.away_score : null,
    });
  }

  // Predicciones de orden por jugador y grupo: user -> group -> {team: rank}
  const predByUserGroup = new Map<string, Map<string, Record<string, number>>>();
  for (const row of gspRaw ?? []) {
    if (!visibleIds.has(row.user_id)) continue;
    if (!predByUserGroup.has(row.user_id))
      predByUserGroup.set(row.user_id, new Map());
    const ug = predByUserGroup.get(row.user_id)!;
    if (!ug.has(row.group_label)) ug.set(row.group_label, {});
    ug.get(row.group_label)![row.team] = row.predicted_rank;
  }

  // Construir los bloques por grupo.
  const groupLabels = Object.keys(byGroup).sort();
  const blocks: GroupBlock[] = groupLabels.map((label) => {
    const g = byGroup[label];
    const table = groupTable([...g.teams], g.matches);
    const realRank = rankMap(table); // equipo -> posición real actual
    const playedInGroup = table.reduce((s, r) => s + r.played, 0) / 2;

    // Predicciones + puntos provisionales por jugador.
    const predictions = visiblePlayers.map((p) => {
      const predMap = predByUserGroup.get(p.id)?.get(label) ?? {};
      // Orden pronosticado: array de equipos por rank 1..N.
      const ordered: string[] = [];
      for (const [team, rank] of Object.entries(predMap)) {
        ordered[rank - 1] = team;
      }
      // Puntos provisionales: equipos bien colocados respecto a la tabla real
      // actual. Si el grupo aún no tiene partidos, realRank los posiciona pero
      // sin resultados todos quedan empatados (provisional 0 hasta que se juegue).
      const provisional =
        playedInGroup > 0 ? groupOrderPoints(predMap, realRank) : 0;
      return {
        userId: p.id,
        name: p.display_name,
        ordered: ordered.filter(Boolean),
        provisional,
      };
    });

    return {
      label,
      table: table.map((r) => ({
        team: r.team,
        played: r.played,
        gd: r.gd,
        points: r.points,
      })),
      groupComplete: table.length > 0 && table.every((r) => r.played === 3),
      predictions,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">📊 Grupos</h1>
        <p className="text-sm text-slate-600">
          Clasificación real al día de cada grupo, lo que predijo cada uno y los
          puntos de grupo que sumaría si quedara así.{" "}
          <Link href="/clasificacion" className="text-pitch underline">
            Ver clasificación general
          </Link>
          .
        </p>
      </div>
      <GroupsView blocks={blocks} currentUserId={me.id} />
    </div>
  );
}
