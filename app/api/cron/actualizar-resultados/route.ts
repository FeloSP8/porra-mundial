import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFullUpdate } from "@/lib/recalc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rutina diaria. Vercel Cron la llama con el header
 * "Authorization: Bearer <CRON_SECRET>". También se puede disparar a mano con
 * curl para probar. El proceso completo vive en runFullUpdate (lib/recalc.ts),
 * compartido con el botón del panel admin.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const log = await runFullUpdate(admin);
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...log });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
