import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFullUpdateLogged } from "@/lib/recalc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rutina diaria. Vercel Cron la llama con el header
 * "Authorization: Bearer <CRON_SECRET>". También se puede disparar a mano con
 * curl para probar. El proceso completo vive en runFullUpdate (lib/recalc.ts),
 * compartido con el botón del panel admin. Cada ejecución queda registrada en
 * `cron_runs`.
 *
 * Devuelve estado NO-200 si el proceso peta (500) o si football-data falla
 * (502), para que Vercel también marque la ejecución como fallida.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { log, ok, footballDataError, error } = await runFullUpdateLogged(
    admin,
    "cron"
  );
  const ranAt = new Date().toISOString();

  if (!ok) {
    return NextResponse.json({ ok: false, ranAt, error }, { status: 500 });
  }
  if (footballDataError) {
    return NextResponse.json(
      { ok: true, ranAt, footballDataError, ...log },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, ranAt, ...log });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
