// ============================================================================
//  Comprobación de configuración. Ejecútalo ANTES de desplegar o si algo falla.
//
//  Uso:
//    npm run check
//
//  Verifica, en orden:
//   1. Que las 5 variables de entorno existen.
//   2. Que se conecta a Supabase con la service_role key.
//   3. Que el esquema (schema.sql) está aplicado (existen las tablas y las
//      6 fases).
//   4. Que hay usuarios dados de alta (avisa si no).
//   5. Que el token de football-data funciona.
//
//  No modifica nada: solo lee. Sale con código 1 si algo crítico falla.
// ============================================================================

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const warn = (m: string) => console.log(`  ⚠ ${m}`);
const fail = (m: string) => console.log(`  ✗ ${m}`);

let hardError = false;

async function main() {
  console.log("\n🔍 Comprobando configuración de Porra Mundial 2026\n");

  // 1) Variables de entorno -------------------------------------------------
  console.log("1) Variables de entorno");
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FOOTBALL_DATA_TOKEN",
    "CRON_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  for (const k of required) {
    if (process.env[k]) ok(k);
    else fail(`${k} (falta)`);
  }
  if (missing.length) {
    hardError = true;
    console.log(
      "\n   Crea .env.local a partir de .env.local.example y rellénalo.\n"
    );
    return; // sin variables no podemos seguir
  }

  // 2) Conexión a Supabase --------------------------------------------------
  console.log("\n2) Conexión a Supabase (service_role)");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 3) Esquema aplicado -----------------------------------------------------
  console.log("\n3) Esquema (tablas y fases)");
  const tables = [
    "profiles",
    "phases",
    "matches",
    "predictions",
    "group_standings_predictions",
    "submissions",
    "group_results",
  ];
  for (const t of tables) {
    const { error } = await supabase.from(t).select("*", {
      count: "exact",
      head: true,
    });
    if (error) {
      fail(`tabla "${t}" no accesible: ${error.message}`);
      hardError = true;
    } else {
      ok(`tabla "${t}"`);
    }
  }

  const { data: phases, error: phErr } = await supabase
    .from("phases")
    .select("key");
  if (phErr) {
    fail("no pude leer phases: " + phErr.message);
    hardError = true;
  } else if ((phases?.length ?? 0) !== 7) {
    warn(
      `esperaba 7 fases (6 + cuadro) y hay ${phases?.length ?? 0}. ¿Aplicaste schema.sql?`
    );
  } else {
    ok("7 fases presentes (6 + cuadro)");
  }

  // 4) Usuarios -------------------------------------------------------------
  console.log("\n4) Jugadores");
  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });
  if (!userCount) {
    warn("no hay jugadores aún. Ejecuta: npm run seed:users");
  } else {
    ok(`${userCount} jugador(es) dados de alta`);
    const { count: adminCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_admin", true);
    if (!adminCount) warn("ningún jugador es admin (marca uno con is_admin)");
    else ok(`${adminCount} admin(s)`);
  }

  // 5) football-data --------------------------------------------------------
  console.log("\n5) football-data.org");
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN! } }
    );
    if (res.ok) {
      const data = await res.json();
      ok(`token válido (${data.matches?.length ?? 0} partidos del Mundial)`);
      const { count: matchCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true });
      if (!matchCount) warn("BD sin partidos. Ejecuta: npm run load:calendar");
      else ok(`${matchCount} partidos cargados en la BD`);
    } else {
      fail(`football-data respondió ${res.status} ${res.statusText}`);
      hardError = true;
    }
  } catch (e: any) {
    fail("error llamando a football-data: " + (e?.message ?? e));
    hardError = true;
  }

  console.log("");
  if (hardError) {
    console.log("❌ Hay errores que arreglar antes de desplegar.\n");
    process.exit(1);
  } else {
    console.log("✅ Configuración OK. Puedes desplegar.\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
