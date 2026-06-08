// ============================================================================
//  Sincroniza el calendario del Mundial desde football-data hacia la BD.
//
//  Crea los partidos nuevos (incluidos los cruces de eliminatoria a medida que
//  se confirman los emparejamientos) y actualiza los existentes. Idempotente
//  por external_id. Reutilizado por:
//    - scripts/load-calendar.ts (carga manual)
//    - el cron diario (creación automática de cruces entre fases)
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMatches, teamName, groupLabelOf } from "./footballdata";
import { STAGE_TO_PHASE } from "./constants";

export async function syncCalendar(admin: SupabaseClient): Promise<{
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}> {
  // Mapa key -> phase_id
  const { data: phases, error: phErr } = await admin
    .from("phases")
    .select("id, key");
  if (phErr || !phases) {
    return { created: 0, updated: 0, skipped: 0, error: phErr?.message };
  }
  const phaseId: Record<string, number> = {};
  for (const p of phases) phaseId[p.key] = p.id;

  const result = await fetchMatches();
  if (!result.ok) {
    return { created: 0, updated: 0, skipped: 0, error: result.error };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const fm of result.matches) {
    const phaseKey = STAGE_TO_PHASE[fm.stage];
    if (!phaseKey || !phaseId[phaseKey]) {
      skipped++;
      continue;
    }

    const home = teamName(fm.homeTeam);
    const away = teamName(fm.awayTeam);
    // Saltar emparejamientos aún sin definir (eliminatorias futuras).
    if (home === "—" || away === "—") {
      skipped++;
      continue;
    }

    const row = {
      external_id: fm.id,
      phase_id: phaseId[phaseKey],
      stage: fm.stage,
      group_label: groupLabelOf(fm.group),
      matchday: fm.matchday,
      home_team: home,
      away_team: away,
      kickoff: fm.utcDate,
      home_score: fm.score?.fullTime?.home ?? null,
      away_score: fm.score?.fullTime?.away ?? null,
      status: fm.status === "FINISHED" ? "FINISHED" : "SCHEDULED",
    };

    const { data: existing } = await admin
      .from("matches")
      .select("id")
      .eq("external_id", fm.id)
      .maybeSingle();

    if (existing) {
      await admin.from("matches").update(row).eq("external_id", fm.id);
      updated++;
    } else {
      await admin.from("matches").insert(row);
      created++;
    }
  }

  return { created, updated, skipped };
}
