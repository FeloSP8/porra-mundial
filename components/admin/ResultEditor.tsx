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
  const [busy, setBusy] = useState(false);

  async function save(clear = false) {
    setBusy(true);
    await fetch("/api/admin/resultado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        clear
          ? { matchId: match.id, clear: true }
          : { matchId: match.id, homeScore: Number(home), awayScore: Number(away) }
      ),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-2 border-t py-2 text-sm">
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
        disabled={busy || home === "" || away === ""}
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
  );
}
