import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import { buildR32FromGroups, type ThirdStat } from "@/lib/bracket";
import { groupTable, type TableMatch } from "@/lib/groupTable";
import BracketView from "@/components/BracketView";

export const dynamic = "force-dynamic";

export default async function CuadroPage() {
  const profile = await requireProfile();
  const supabase = createClient();

  // Fase virtual 'bracket'.
  const { data: phase } = await supabase
    .from("phases")
    .select("*")
    .eq("key", "bracket")
    .single<Phase>();

  if (!phase) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-bold">Cuadro completo</h1>
        <p className="mt-2 text-slate-600">
          La modalidad de cuadro aún no está activada. (Falta aplicar la
          migración en la base de datos.)
        </p>
      </div>
    );
  }

  // Orden de grupos pronosticado por el jugador (de group_standings_predictions).
  const { data: gsp } = await supabase
    .from("group_standings_predictions")
    .select("group_label, team, predicted_rank")
    .eq("user_id", profile.id);

  // rankByGroup: "A".."L" -> [1º,2º,3º,4º]
  const rankByGroup: Record<string, string[]> = {};
  for (const row of gsp ?? []) {
    (rankByGroup[row.group_label] ??= [])[row.predicted_rank - 1] = row.team;
  }

  const hasGroups = Object.keys(rankByGroup).length > 0;

  // ¿Ya envió el cuadro?
  const { data: sub } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", profile.id)
    .eq("phase_id", phase.id)
    .maybeSingle();
  const alreadySubmitted = !!sub;

  // Picks previos (borrador).
  const { data: bp } = await supabase
    .from("bracket_predictions")
    .select("slot, team")
    .eq("user_id", profile.id);
  const initialPicks: Record<string, string> = {};
  for (const r of bp ?? []) initialPicks[r.slot] = r.team;

  const readOnly = alreadySubmitted || !phaseAcceptsSubmissions(phase);

  if (!hasGroups) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">🏆 Cuadro completo</h1>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          El cuadro se construye a partir de tu pronóstico de la{" "}
          <b>fase de grupos</b>. Primero rellena los marcadores de grupos (así se
          calcula tu clasificación de cada grupo) y luego vuelve aquí.
          <div className="mt-3">
            <Link
              href="/predicciones/groups"
              className="inline-block rounded-lg bg-pitch px-4 py-2 font-semibold text-white hover:opacity-90"
            >
              Ir a la fase de grupos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Estadísticas de cada tercero (puntos/dif.goles/goles) recomputando las
  // tablas de grupo desde los marcadores que pronosticó el jugador. Sirve para
  // elegir los 8 MEJORES terceros por mérito (regla oficial), no por alfabeto.
  const { thirdsStats, teamGroup } = await computeThirdsStats(
    supabase,
    profile.id
  );

  const initialR32 = buildR32FromGroups(rankByGroup, thirdsStats, teamGroup);

  return (
    <BracketView
      initialR32={initialR32}
      initialPicks={initialPicks}
      readOnly={readOnly}
      alreadySubmitted={alreadySubmitted}
    />
  );
}

/**
 * Recomputa las tablas de grupo desde los marcadores pronosticados por el
 * jugador y devuelve, para cada equipo que queda 3º, sus estadísticas, además
 * de un mapa equipo->grupo.
 */
async function computeThirdsStats(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{
  thirdsStats: Record<string, ThirdStat>;
  teamGroup: Record<string, string>;
}> {
  // Partidos de la fase de grupos (con grupo y equipos).
  const { data: groupsPhase } = await supabase
    .from("phases")
    .select("id")
    .eq("key", "groups")
    .single();

  const { data: matchRows } = groupsPhase
    ? await supabase
        .from("matches")
        .select("id, group_label, home_team, away_team")
        .eq("phase_id", groupsPhase.id)
        .not("group_label", "is", null)
    : { data: [] as any[] };

  const matchIds = (matchRows ?? []).map((m: any) => m.id);
  const { data: preds } = matchIds.length
    ? await supabase
        .from("predictions")
        .select("match_id, pred_home, pred_away")
        .eq("user_id", userId)
        .in("match_id", matchIds)
    : { data: [] as any[] };
  const predByMatch = new Map(
    (preds ?? []).map((p: any) => [p.match_id, p])
  );

  // Construir, por grupo, los equipos y los TableMatch con los marcadores.
  const byGroup: Record<
    string,
    { teams: Set<string>; matches: TableMatch[] }
  > = {};
  const teamGroup: Record<string, string> = {};
  for (const m of matchRows ?? []) {
    const g = (byGroup[m.group_label] ??= { teams: new Set(), matches: [] });
    g.teams.add(m.home_team);
    g.teams.add(m.away_team);
    teamGroup[m.home_team] = m.group_label;
    teamGroup[m.away_team] = m.group_label;
    const p = predByMatch.get(m.id);
    g.matches.push({
      home_team: m.home_team,
      away_team: m.away_team,
      home_score: p ? p.pred_home : null,
      away_score: p ? p.pred_away : null,
    });
  }

  const thirdsStats: Record<string, ThirdStat> = {};
  for (const [, g] of Object.entries(byGroup)) {
    const table = groupTable([...g.teams], g.matches);
    const third = table[2]; // 3ª posición
    if (third) {
      thirdsStats[third.team] = {
        points: third.points,
        gd: third.gd,
        gf: third.gf,
      };
    }
  }

  return { thirdsStats, teamGroup };
}
