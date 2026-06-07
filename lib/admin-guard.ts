import { createClient } from "@/lib/supabase/server";

/**
 * Verifica que quien llama es un admin logueado.
 * Devuelve { ok: true } o { ok: false, status } para usar en route handlers.
 */
export async function assertAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; status: number }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}
