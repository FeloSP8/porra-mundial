// ============================================================================
//  Carga / actualiza el calendario del Mundial en la BD desde football-data.
//
//  Uso:
//    npm run load:calendar
//
//  Casa cada partido por external_id, así que es seguro re-ejecutarlo: actualiza
//  los existentes y crea los nuevos (útil cuando se conocen los emparejamientos
//  de las eliminatorias). La lógica vive en lib/syncCalendar.ts (compartida con
//  el cron).
// ============================================================================

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { syncCalendar } from "../lib/syncCalendar";

async function main() {
  const admin = createAdminClient();
  const res = await syncCalendar(admin);
  if (res.error) {
    throw new Error("football-data falló: " + res.error);
  }
  console.log(
    `Hecho. Creados: ${res.created}, actualizados: ${res.updated}, saltados: ${res.skipped}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
