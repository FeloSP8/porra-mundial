import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Actualiza una fase: abrir/cerrar y/o fijar deadline.
 * Body: { phaseId: number, isOpen?: boolean, deadline?: string|null }
 */
export async function POST(request: Request) {
  const guard = await assertAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: "No autorizado" }, { status: guard.status });
  }

  const { phaseId, isOpen, deadline } = await request.json();
  if (typeof phaseId !== "number") {
    return NextResponse.json({ error: "phaseId requerido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof isOpen === "boolean") patch.is_open = isOpen;
  if (deadline !== undefined) {
    patch.deadline = deadline === "" || deadline === null ? null : deadline;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("phases").update(patch).eq("id", phaseId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
