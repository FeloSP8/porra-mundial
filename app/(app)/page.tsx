import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import PhaseProgress from "@/components/PhaseProgress";
import LeaderboardTable from "@/components/LeaderboardTable";
import HomeMatchdayCard from "@/components/HomeMatchdayCard";
import { loadMatchdayData } from "@/lib/loadMatchdayData";

export const dynamic = "force-dynamic";

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

  const matchdayData = await loadMatchdayData(profile.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile.display_name} 👋</h1>
        <p className="text-slate-600">Bienvenido a la porra del Mundial 2026.</p>
      </div>

      {/* Aviso de fase abierta con CTA */}
      {openPhase ? (
        <div className="rounded-xl border border-gold bg-yellow-50 p-5">
          <p className="font-semibold">🟢 Fase abierta: {openPhase.name}</p>
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
            className="mt-3 block sm:inline-block w-full sm:w-auto text-center rounded-lg bg-pitch px-4 py-2.5 font-semibold text-white hover:opacity-90 transition"
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

      {/* Clasificación general */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">🏆 Clasificación general</h2>
          <Link
            href="/clasificacion"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 whitespace-nowrap"
          >
            Detalle →
          </Link>
        </div>
        <LeaderboardTable currentUserId={profile.id} compact />
      </section>

      {/* Jornada actual / próxima */}
      <HomeMatchdayCard
        matches={matchdayData.matches}
        users={matchdayData.users}
        predictions={matchdayData.predictions}
        closedPhaseKeys={matchdayData.closedPhaseKeys}
        currentUserId={profile.id}
      />

      {/* Estado de los pronósticos (de la fase abierta) */}
      {openPhase && <PhaseProgress phase={openPhase} />}
    </div>
  );
}
