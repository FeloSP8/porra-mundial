import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import type {
  MatchdayMatch,
  UserSlim,
  PredictionSlim,
} from "@/components/MatchdayView";

/**
 * Vista "resumen" para la home: muestra los partidos de HOY (desde las 00:00
 * de hoy) y los que quedan por jugar, en orden temporal. Los resultados de
 * días anteriores no se muestran aquí (se ven en /jornadas con "Ver todas").
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
  // Inicio de "hoy" a las 00:00 hora de España (no la del servidor, que en
  // Vercel es UTC). Así "hoy 15 de junio" empieza a las 00:00 españolas aunque
  // el servidor esté en otra zona.
  const startMs = startOfTodayInSpain();

  // Partidos de hoy + futuros (con kickoff conocido), ordenados por fecha.
  const upcoming = matches
    .filter((m) => m.kickoff && Date.parse(m.kickoff) >= startMs)
    .sort((a, b) => Date.parse(a.kickoff!) - Date.parse(b.kickoff!));

  // Limitar para no hacer la home enorme: los próximos ~10 partidos.
  const shown = upcoming.slice(0, 10);

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
          <h2 className="text-lg font-semibold">⚽ Hoy y próximos partidos</h2>
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

/**
 * Devuelve el timestamp (ms) de las 00:00 de HOY en hora de España
 * (Europe/Madrid), independientemente de la zona horaria del servidor.
 */
function startOfTodayInSpain(): number {
  const now = new Date();
  // Partes de fecha "ahora" tal como se ven en España.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = fmt.format(now); // "2026-06-15"
  // El offset de España (en min) en este momento: comparar la misma fecha
  // formateada con hora vs UTC. Más simple: construir medianoche local con el
  // offset actual de Madrid.
  const offsetMin = madridOffsetMinutes(now);
  // Medianoche en España = ese día a las 00:00, expresado en UTC restando el offset.
  return Date.parse(`${ymd}T00:00:00Z`) - offsetMin * 60_000;
}

/** Offset de Europe/Madrid respecto a UTC, en minutos, para una fecha dada. */
function madridOffsetMinutes(date: Date): number {
  // Hora "vista" en Madrid vs UTC, derivada de Intl.
  const madrid = new Date(
    date.toLocaleString("en-US", { timeZone: "Europe/Madrid" })
  );
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((madrid.getTime() - utc.getTime()) / 60_000);
}
