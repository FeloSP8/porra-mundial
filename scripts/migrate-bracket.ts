// ============================================================================
//  Migración: añadir la modalidad "Cuadro completo" (bracket).
//
//  Uso:
//    1. Primero aplica el schema actualizado en Supabase (SQL Editor → pega
//       supabase/schema.sql → Run). Eso crea la tabla bracket_predictions y la
//       fase 'bracket'. Es idempotente.
//    2. Luego ejecuta:  npm run migrate:bracket
//
//  Este script:
//    - Verifica que la tabla bracket_predictions y la fase 'bracket' existen.
//    - RESET de envíos de la fase de grupos: borra las filas de `submissions`
//      de la fase de grupos para devolver a todos a estado BORRADOR, de modo
//      que puedan completar también el cuadro antes de reenviar.
//    - NO toca `predictions` ni `group_standings_predictions`: lo verifica
//      contando filas antes y después (deben quedar idénticas).
//
//  Seguro de re-ejecutar.
// ============================================================================

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";

async function count(admin: ReturnType<typeof createAdminClient>, table: string) {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function main() {
  const admin = createAdminClient();

  // 1) Verificar tabla bracket_predictions (seleccionando columnas reales, no
  //    solo count head, que puede dar falsos positivos con el schema cache).
  const { error: tblErr } = await admin
    .from("bracket_predictions")
    .select("id, user_id, slot, round, team, points_awarded")
    .limit(1);
  if (tblErr) {
    console.error(
      "✗ La tabla bracket_predictions no existe o no está en el schema cache.\n" +
        "  Aplica primero supabase/schema.sql en el SQL Editor de Supabase\n" +
        "  (eso crea la tabla y recarga el cache) y vuelve a ejecutar.\n" +
        "  Detalle: " + tblErr.message
    );
    process.exit(1);
  }
  console.log("✓ Tabla bracket_predictions presente.");

  // 2) Verificar fase 'bracket'.
  const { data: bracketPhase } = await admin
    .from("phases")
    .select("id")
    .eq("key", "bracket")
    .maybeSingle();
  if (!bracketPhase) {
    console.error(
      "✗ Falta la fase 'bracket'. Aplica primero supabase/schema.sql y reintenta."
    );
    process.exit(1);
  }
  console.log("✓ Fase 'bracket' presente.");

  // 3) Contar datos sensibles ANTES (no deben cambiar).
  const before = {
    predictions: await count(admin, "predictions"),
    gsp: await count(admin, "group_standings_predictions"),
  };

  // 4) Reset de envíos de la fase de grupos.
  const { data: groupsPhase } = await admin
    .from("phases")
    .select("id")
    .eq("key", "groups")
    .single();

  const { count: subsBefore } = await admin
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("phase_id", groupsPhase!.id);

  const { error: delErr } = await admin
    .from("submissions")
    .delete()
    .eq("phase_id", groupsPhase!.id);
  if (delErr) {
    console.error("✗ Error al resetear envíos de grupos:", delErr.message);
    process.exit(1);
  }
  console.log(
    `✓ Envíos de la fase de grupos reseteados: ${subsBefore ?? 0} jugador(es) vuelven a BORRADOR.`
  );

  // 5) Verificar que los datos sensibles NO cambiaron.
  const after = {
    predictions: await count(admin, "predictions"),
    gsp: await count(admin, "group_standings_predictions"),
  };

  if (
    before.predictions !== after.predictions ||
    before.gsp !== after.gsp
  ) {
    console.error(
      `✗ ¡ALERTA! Cambió el número de filas de datos sensibles. Antes: ${JSON.stringify(
        before
      )} Después: ${JSON.stringify(after)}`
    );
    process.exit(1);
  }
  console.log(
    `✓ Datos intactos: predictions=${after.predictions}, group_standings_predictions=${after.gsp} (sin cambios).`
  );

  console.log("\n✅ Migración del cuadro completada sin pérdida de datos.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
