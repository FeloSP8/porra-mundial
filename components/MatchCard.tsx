"use client";

import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import type {
  MatchdayMatch,
  UserSlim,
  PredictionSlim,
} from "@/components/MatchdayView";

/**
 * Tarjeta de un partido: cabecera con fecha+grupo, marcador real, y opcional
 * lista de pronósticos por jugador con puntos.
 */
export default function MatchCard({
  match,
  users,
  preds,
  revealPredictions,
  currentUserId,
}: {
  match: MatchdayMatch;
  users: UserSlim[];
  preds: Map<string, PredictionSlim>;
  revealPredictions: boolean;
  currentUserId: string;
}) {
  const finished = match.status === "FINISHED";
  const kickoffLabel = match.kickoff
    ? new Date(match.kickoff).toLocaleString("es-ES", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Por definir";

  return (
    <article className="rounded-xl border bg-white p-3 sm:p-4">
      <header className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="truncate">
          {kickoffLabel}
          {match.group_label && <span> · Grupo {match.group_label}</span>}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            finished
              ? "bg-slate-200 text-slate-700"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {finished ? "FINAL" : "Pendiente"}
        </span>
      </header>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-sm font-medium">
          <span className="truncate text-right" title={esName(match.home_team)}>
            {esName(match.home_team)}
          </span>
          <Flag team={match.home_team} className="flex-shrink-0" />
        </div>
        <div className="flex w-20 flex-shrink-0 items-center justify-center gap-1 text-lg font-bold">
          {finished ? (
            <>
              <span>{match.home_score}</span>
              <span className="text-slate-400">-</span>
              <span>{match.away_score}</span>
            </>
          ) : (
            <span className="text-slate-300">–</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium">
          <Flag team={match.away_team} className="flex-shrink-0" />
          <span className="truncate" title={esName(match.away_team)}>
            {esName(match.away_team)}
          </span>
        </div>
      </div>

      {revealPredictions && (
        <ul className="mt-3 divide-y border-t pt-2 text-sm">
          {users.map((u) => {
            const p = preds.get(u.id);
            const isMe = u.id === currentUserId;
            return (
              <li
                key={u.id}
                className={`flex items-center justify-between gap-2 py-1.5 ${
                  isMe ? "font-semibold" : ""
                }`}
              >
                <span className="truncate" title={u.display_name}>
                  {u.display_name}
                  {isMe && (
                    <span className="ml-1 text-xs text-slate-400">(tú)</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-slate-700">
                    {p ? `${p.pred_home}–${p.pred_away}` : "—"}
                  </span>
                  {finished && p && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        p.points_awarded > 0
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.points_awarded > 0
                        ? `+${p.points_awarded} pts`
                        : "0 pts"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
