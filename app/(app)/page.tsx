import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";

export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: phases } = await supabase
    .from("phases")
    .select("*")
    .order("order");

  const { data: subs } = await supabase
    .from("submissions")
    .select("phase_id")
    .eq("user_id", profile.id);

  const submittedPhaseIds = new Set((subs ?? []).map((s) => s.phase_id));
  const openPhase = (phases ?? []).find((p: Phase) =>
    phaseAcceptsSubmissions(p)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile.display_name} 👋</h1>
        <p className="text-slate-600">Bienvenido a la porra del Mundial 2026.</p>
      </div>

      {openPhase ? (
        <div className="rounded-xl border border-gold bg-yellow-50 p-5">
          <p className="font-semibold">
            🟢 Fase abierta: {openPhase.name}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {submittedPhaseIds.has(openPhase.id)
              ? "Ya has enviado tu pronóstico (puedes revisarlo)."
              : "Aún no has enviado tu pronóstico para esta fase."}
            {openPhase.deadline && (
              <>
                {" "}
                Cierra el{" "}
                {new Date(openPhase.deadline).toLocaleString("es-ES", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
                .
              </>
            )}
          </p>
          <Link
            href={`/predicciones/${openPhase.key}`}
            className="mt-3 inline-block rounded-lg bg-pitch px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            {submittedPhaseIds.has(openPhase.id)
              ? "Ver mi pronóstico"
              : "Rellenar pronóstico"}
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-5">
          <p className="text-slate-600">
            Ahora mismo no hay ninguna fase abierta para enviar pronósticos.
            Cuando se abra la siguiente, aparecerá aquí.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/clasificacion"
          className="rounded-xl border bg-white p-5 transition hover:shadow"
        >
          <p className="text-lg font-semibold">🏆 Clasificación</p>
          <p className="text-sm text-slate-600">
            Mira cómo va la porra entre todos.
          </p>
        </Link>
        <Link
          href="/predicciones"
          className="rounded-xl border bg-white p-5 transition hover:shadow"
        >
          <p className="text-lg font-semibold">📋 Mis pronósticos</p>
          <p className="text-sm text-slate-600">
            Revisa tus pronósticos de cada fase.
          </p>
        </Link>
      </div>
    </div>
  );
}
