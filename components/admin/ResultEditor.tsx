"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/types";
import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";

export default function ResultEditor({ match }: { match: Match }) {
  const router = useRouter();
  const [home, setHome] = useState(
    match.home_score !== null ? String(match.home_score) : ""
  );
  const [away, setAway] = useState(
    match.away_score !== null ? String(match.away_score) : ""
  );
  const [winner, setWinner] = useState<"HOME_TEAM" | "AWAY_TEAM" | null>(
    match.winner === "HOME_TEAM" || match.winner === "AWAY_TEAM"
      ? match.winner
      : null
  );
  const [busy, setBusy] = useState(false);

  // Eliminatoria: en empate a 90' hay que elegir quién pasó (prórroga/penaltis).
  const isKO = !!match.stage && match.stage !== "GROUP_STAGE";
  const isDraw = home !== "" && away !== "" && Number(home) === Number(away);
  const needsWinner = isKO && isDraw;

  async function save(clear = false) {
    setBusy(true);
    await fetch("/api/admin/resultado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        clear
          ? { matchId: match.id, clear: true }
          : {
              matchId: match.id,
              homeScore: Number(home),
              awayScore: Number(away),
              winner: needsWinner ? winner : undefined,
            }
      ),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="border-t py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex w-2/5 items-center justify-end gap-1.5 text-right">
          <span className="truncate">{esName(match.home_team)}</span>
          <Flag team={match.home_team} />
        </span>
        <div className="flex items-center gap-1">
          <input
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            className="w-9 rounded border border-slate-300 px-1 py-0.5 text-center"
          />
          <span className="text-slate-400">-</span>
          <input
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            className="w-9 rounded border border-slate-300 px-1 py-0.5 text-center"
          />
        </div>
        <span className="flex w-2/5 items-center gap-1.5">
          <Flag team={match.away_team} />
          <span className="truncate">{esName(match.away_team)}</span>
        </span>
        <button
          disabled={busy || home === "" || away === "" || (needsWinner && !winner)}
          onClick={() => save(false)}
          className="rounded bg-pitch px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          {match.status === "FINISHED" ? "Editar" : "Guardar"}
        </button>
        {match.status === "FINISHED" && (
          <button
            disabled={busy}
            onClick={() => save(true)}
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
            title="Volver a marcar como no jugado"
          >
            ✕
          </button>
        )}
      </div>

      {/* Selector de ganador (solo eliminatoria empatada a 90'). */}
      {needsWinner && (
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs">
          <span className="text-amber-800">
            Empate a 90&apos;: ¿quién pasó (prórroga/penaltis)?
          </span>
          <button
            type="button"
            onClick={() => setWinner("HOME_TEAM")}
            className={`rounded-full border px-2 py-0.5 font-medium ${
              winner === "HOME_TEAM"
                ? "border-pitch bg-pitch text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {esName(match.home_team)}
          </button>
          <button
            type="button"
            onClick={() => setWinner("AWAY_TEAM")}
            className={`rounded-full border px-2 py-0.5 font-medium ${
              winner === "AWAY_TEAM"
                ? "border-pitch bg-pitch text-white"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {esName(match.away_team)}
          </button>
        </div>
      )}
    </div>
  );
}
