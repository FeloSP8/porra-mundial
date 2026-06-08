import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import { buildMatchdays, defaultMatchdayIndex } from "@/lib/matchdays";
import type {
  MatchdayMatch,
  UserSlim,
  PredictionSlim,
} from "@/components/MatchdayView";

/**
 * Vista "resumen" para la home: una sola jornada (la actual o próxima) con
 * sus partidos. Sin tabs; para navegar hay un enlace a /jornadas.
 *
 * Regla de visibilidad de pronósticos:
 *  - Si la fase está cerrada → se muestran todos los pronósticos.
 *  - Si está abierta → se muestran sólo si hay >=2 usuarios con pronóstico para
 *    ese partido (es decir, yo envié y algún otro también). Si solo aparezco yo,
 *    no mostramos nada para no revelar mis propios marcadores en la home antes
 *    de enviar.
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
  const matchdays = buildMatchdays(matches);
  if (matchdays.length === 0) return null;

  const idx = defaultMatchdayIndex(matchdays);
  const active = matchdays[idx];
  const closedSet = new Set(closedPhaseKeys);
  const phaseClosed = closedSet.has(active.matches[0].phase_key);

  // Índice match_id -> mapa user_id -> prediction
  const predIndex = new Map<number, Map<string, PredictionSlim>>();
  for (const p of predictions) {
    if (!predIndex.has(p.match_id)) predIndex.set(p.match_id, new Map());
    predIndex.get(p.match_id)!.set(p.user_id, p);
  }

  // ¿Hay pronósticos de OTROS jugadores ya visibles? Solo en ese caso vale la
  // pena revelar la lista (si solo aparecen los míos, los oculto en la home).
  const someoneElseSubmitted = predictions.some(
    (p) => p.user_id !== currentUserId
  );
  const reveal = phaseClosed || someoneElseSubmitted;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">⚽ {active.longLabel}</h2>
          <p className="text-xs text-slate-500">
            {phaseClosed
              ? "Pronósticos de todos los jugadores."
              : reveal
              ? "Tus pronósticos y los de quienes ya enviaron."
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
        {active.matches.map((m) => (
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
