// ============================================================================
//  Login por nombre de usuario.
//
//  Supabase Auth trabaja con email, pero los jugadores entran con un usuario
//  simple (oscar, juanmi, ...). Internamente lo convertimos a un email
//  "<usuario>@porra.local" que nunca ven. Toda la conversión vive aquí.
// ============================================================================

/** Dominio interno (no necesita ser un correo real). */
export const INTERNAL_DOMAIN = "porra.local";

/** Normaliza un usuario: minúsculas y sin espacios alrededor. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** "oscar" -> "oscar@porra.local" */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_DOMAIN}`;
}

/** "oscar@porra.local" -> "oscar" (para mostrar) */
export function emailToUsername(email: string): string {
  return email.replace(`@${INTERNAL_DOMAIN}`, "");
}
