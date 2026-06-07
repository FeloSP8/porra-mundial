// ============================================================================
//  Carga / actualiza el calendario del Mundial en la BD desde football-data.
//
//  Uso:
//    npm run load:calendar
//
//  Lee .env.local automáticamente. Casa cada partido por external_id, así que
//  es seguro re-ejecutarlo: actualiza los existentes y crea los nuevos (útil
//  cuando se conocen los emparejamientos de las eliminatorias).
// ============================================================================

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { fetchMatches, teamName, groupLabelOf } from "../lib/footballdata";
import { STAGE_TO_PHASE } from "../lib/constants";

async function main() {
  const admin = createAdminClient();

  // mapa key -> phase_id
  const { data: phases, error: phErr } = await admin
    .from("phases")
    .select("id, key");
  if (phErr || !phases) {
    throw new Error("No pude leer las fases: " + phErr?.message);
  }
  const phaseId: Record<string, number> = {};
  for (const p of phases) phaseId[p.key] = p.id;

  const result = await fetchMatches(); // todos los partidos
  if (!result.ok) {
    throw new Error("football-data falló: " + result.error);
  }
  console.log(`football-data devolvió ${result.matches.length} partidos.`);

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

  console.log(
    `Hecho. Creados: ${created}, actualizados: ${updated}, saltados: ${skipped}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
