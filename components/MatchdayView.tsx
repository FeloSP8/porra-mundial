"use client";

import { useMemo, useState } from "react";
import {
  buildMatchdays,
  defaultMatchdayIndex,
} from "@/lib/matchdays";
import MatchCard from "@/components/MatchCard";

export type MatchdayMatch = {
  id: number;
  phase_key: string;
  phase_name: string;
  matchday: number | null;
  group_label: string | null;
  home_team: string;
  away_team: string;
  kickoff: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "SCHEDULED" | "FINISHED";
};

export type UserSlim = { id: string; display_name: string };

export type PredictionSlim = {
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
  points_awarded: number;
};

// (buildMatchdays / defaultMatchdayIndex viven en lib/matchdays.ts y se
// comparten con la home — ver imports arriba.)

export default function MatchdayView({
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
  const matchdays = useMemo(() => buildMatchdays(matches), [matches]);
  const closed = useMemo(() => new Set(closedPhaseKeys), [closedPhaseKeys]);

  const [activeIdx, setActiveIdx] = useState<number>(() =>
    defaultMatchdayIndex(matchdays)
  );

  if (matchdays.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 text-slate-600">
        Aún no hay partidos cargados.
      </div>
    );
  }

  const active = matchdays[activeIdx];
  const activePhaseClosed = closed.has(active.matches[0].phase_key);

  // Índice de predicciones: match_id -> user_id -> prediction
  const predIndex = useMemo(() => {
    const map = new Map<number, Map<string, PredictionSlim>>();
    for (const p of predictions) {
      if (!map.has(p.match_id)) map.set(p.match_id, new Map());
      map.get(p.match_id)!.set(p.user_id, p);
    }
    return map;
  }, [predictions]);

  return (
    <div className="space-y-4">
      {/* Selector de jornadas (scrollable horizontal en móvil) */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {matchdays.map((md, i) => {
            const phaseClosed = closed.has(md.matches[0].phase_key);
            const isActive = i === activeIdx;
            return (
              <button
                key={md.key}
                type="button"
                onClick={() => setActiveIdx(i)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                  isActive
                    ? "bg-pitch text-white border-pitch shadow-sm"
                    : phaseClosed
                    ? "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    : "bg-slate-50 text-slate-400 border-slate-200"
                }`}
                title={md.longLabel}
              >
                {md.shortLabel}
                {!phaseClosed && (
                  <span className="ml-1 text-[10px]" aria-label="fase aún abierta">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="text-lg font-semibold">{active.longLabel}</h2>

      {!activePhaseClosed && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
          Esta fase aún está abierta. Los pronósticos de los demás se mostrarán
          cuando se cierre el plazo.
        </div>
      )}

      <div className="space-y-3">
        {active.matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            users={users}
            preds={predIndex.get(m.id) ?? new Map()}
            revealPredictions={activePhaseClosed}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}

