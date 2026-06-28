import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import { buildMatchdays, defaultMatchdayIndex } from "@/lib/matchdays";
import type {
  MatchdayMatch,
  UserSlim,
  PredictionSlim,
} from "@/components/MatchdayView";

/**
 * Vista "resumen" para la home: muestra la JORNADA/RONDA actual COMPLETA (la
 * primera cuyo último partido aún no ha terminado), con sus resultados ya
 * jugados y los partidos por venir, en orden cronológico. Así se ven todos los
 * partidos de la ronda en curso (p.ej. los 16 de dieciseisavos), no solo unos
 * pocos.
 *
 * Regla de visibilidad de pronósticos:
 *  - Si la fase está cerrada → se muestran todos los pronósticos.
 *  - Si está abierta → se muestran sólo si hay pronósticos de OTROS jugadores
 *    ya visibles (si solo aparezco yo, no revelo mis marcadores en la home).
 */
export default function HomeMatchdayCard({
  matches,
  users,
  predictions,
  closedPhaseKeys,
  currentUserId,
}: {
  matches: MatchdayMatch[];
  users: UserSlim[];
  predictions: PredictionSlim[];
  closedPhaseKeys: string[];
  currentUserId: string;
}) {
  // Jornada/ronda actual completa (resultados + partidos por venir).
  const matchdays = buildMatchdays(matches);
  const current = matchdays[defaultMatchdayIndex(matchdays)] ?? null;
  const shown = current?.matches ?? [];

  if (shown.length === 0) {
    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">⚽ Próximos partidos</h2>
          <Link
            href="/jornadas"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 whitespace-nowrap"
          >
            Ver todas →
          </Link>
        </div>
        <div className="rounded-xl border bg-white p-5 text-sm text-slate-600">
          No hay más partidos próximos. Mira los resultados anteriores en{" "}
          <Link href="/jornadas" className="font-medium text-pitch underline">
            Jornadas
          </Link>
          .
        </div>
      </section>
    );
  }

  const closedSet = new Set(closedPhaseKeys);

  // Índice match_id -> mapa user_id -> prediction
  const predIndex = new Map<number, Map<string, PredictionSlim>>();
  for (const p of predictions) {
    if (!predIndex.has(p.match_id)) predIndex.set(p.match_id, new Map());
    predIndex.get(p.match_id)!.set(p.user_id, p);
  }

  // ¿Hay pronósticos de OTROS jugadores ya visibles entre los partidos mostrados?
  const shownIds = new Set(shown.map((m) => m.id));
  const someoneElseVisible = predictions.some(
    (p) => p.user_id !== currentUserId && shownIds.has(p.match_id)
  );
  // Revelar si alguna fase de los partidos mostrados está cerrada, o si ya hay
  // pronósticos ajenos visibles.
  const anyClosed = shown.some((m) => closedSet.has(m.phase_key));
  const reveal = anyClosed || someoneElseVisible;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            ⚽ {current?.longLabel ?? "Partidos"}
          </h2>
          <p className="text-xs text-slate-500">
            {reveal
              ? "Resultados, y los pronósticos de quienes ya enviaron."
              : "Los pronósticos se mostrarán al cerrarse la fase, o antes si tú y otros ya habéis enviado."}
          </p>
        </div>
        <Link
          href="/jornadas"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 whitespace-nowrap"
        >
          Ver todas →
        </Link>
      </div>

      <div className="space-y-3">
        {shown.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            users={users}
            preds={predIndex.get(m.id) ?? new Map()}
            revealPredictions={reveal}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </section>
  );
}
