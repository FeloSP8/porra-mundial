import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import PhaseProgress from "@/components/PhaseProgress";
import LeaderboardTable from "@/components/LeaderboardTable";
import HomeMatchdayCard from "@/components/HomeMatchdayCard";
import WinnerBanner from "@/components/WinnerBanner";
import { loadMatchdayData } from "@/lib/loadMatchdayData";
import { computeStandings, playerSlug } from "@/lib/standings";

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

  // La fase de partidos abierta (NO la virtual 'bracket').
  const openPhase = (phases ?? []).find(
    (p: Phase) => p.key !== "bracket" && phaseAcceptsSubmissions(p)
  );

  // Estado del CUADRO (fase virtual 'bracket').
  const bracketPhase = (phases ?? []).find((p: Phase) => p.key === "bracket");
  const bracketOpen = bracketPhase
    ? phaseAcceptsSubmissions(bracketPhase)
    : false;
  const bracketSubmitted = bracketPhase
    ? submittedPhaseIds.has(bracketPhase.id)
    : false;

  const matchdayData = await loadMatchdayData(profile.id);

  // ¿Ha terminado el torneo? (final jugada) → mostramos al ganador de la porra.
  const { data: finalMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("stage", "FINAL")
    .eq("status", "FINISHED")
    .limit(1)
    .maybeSingle();
  const tournamentOver = !!finalMatch;
  const winner = tournamentOver
    ? (await computeStandings(supabase))[0] ?? null
    : null;

  return (
    <div className="space-y-6">
      {winner && (
        <WinnerBanner
          name={winner.display_name}
          slug={playerSlug(winner.display_name)}
        />
      )}

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

          {/* Aviso de penalización por no enviar a tiempo */}
          {!submittedPhaseIds.has(openPhase.id) && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              ⚠️ Si no envías antes del cierre, se marcará como enviado igualmente
              y se te restarán <b>2 puntos por cada partido sin pronosticar</b>.
            </p>
          )}

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

      {/* Aviso del CUADRO completo (si está abierto y aún no enviado) */}
      {bracketOpen && !bracketSubmitted && (
        <div className="rounded-xl border border-gold bg-yellow-50 p-5">
          <p className="font-semibold">🏆 ¡Rellena tu cuadro hasta la final!</p>
          <p className="mt-1 text-sm text-slate-600">
            Pronostica todo el cuadro de eliminatorias y el campeón. Suma 1 punto
            extra por cada acierto. Se rellena una sola vez, antes de empezar.
          </p>
          <Link
            href="/cuadro"
            className="mt-3 block sm:inline-block w-full sm:w-auto text-center rounded-lg bg-pitch px-4 py-2.5 font-semibold text-white hover:opacity-90 transition"
          >
            Rellenar cuadro
          </Link>
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
