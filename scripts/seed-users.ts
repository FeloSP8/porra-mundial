// ============================================================================
//  Alta de los jugadores (crea usuarios en Supabase Auth + su perfil).
//
//  Uso:
//    1. Edita la lista PLAYERS de abajo con tus 5 jugadores.
//    2. npm run seed:users
//
//  Crea cada usuario con email + contraseña ya confirmados (sin email de
//  verificación). Reparte a cada jugador su email y contraseña por privado.
//  Re-ejecutable: si un usuario ya existe, lo salta.
// ============================================================================

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { usernameToEmail } from "../lib/username";

// Contraseña temporal igual para todos (cada uno puede cambiarla luego).
const TEMP_PASSWORD = "porra2026";

// 👉 Jugadores. Entran por "username"; el email interno se genera solo.
const PLAYERS: {
  username: string;
  displayName: string;
  isAdmin?: boolean;
}[] = [
  { username: "felipe", displayName: "Felipe", isAdmin: true },
  { username: "oscar", displayName: "Óscar" },
  { username: "juanmi", displayName: "Juanmi" },
  { username: "manolo", displayName: "Manolo" },
  { username: "julio", displayName: "Julio" },
];

async function main() {
  const admin = createAdminClient();

  for (const p of PLAYERS) {
    const email = usernameToEmail(p.username);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: p.displayName },
    });

    if (error) {
      // 422 = ya existe; lo tratamos como "saltado"
      console.log(`- ${p.username}: ${error.message} (saltado)`);
      continue;
    }

    const userId = data.user?.id;
    if (userId) {
      // El trigger crea el perfil; aquí solo ajustamos is_admin si procede.
      await admin
        .from("profiles")
        .update({
          display_name: p.displayName,
          is_admin: !!p.isAdmin,
        })
        .eq("id", userId);
      console.log(
        `+ usuario "${p.username}" creado (${p.displayName})${
          p.isAdmin ? " [admin]" : ""
        }`
      );
    }
  }

  console.log(`\nListo. Contraseña temporal para todos: ${TEMP_PASSWORD}`);
  console.log("Reparte a cada uno su usuario y la contraseña.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
