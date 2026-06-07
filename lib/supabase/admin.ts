import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la SERVICE ROLE key. SALTA RLS.
 *
 * ⚠️ Úsalo SOLO en código de servidor (cron, route handlers de admin,
 * scripts). Nunca lo importes en componentes de cliente: expondría la
 * clave secreta.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
