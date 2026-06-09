"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import BracketTree, { type Pairing } from "@/components/BracketTree";
import { R32_MATCHES, ROUND_SIZES, slotId, type BracketRound } from "@/lib/bracket";

export default function BracketView({
  initialR32,
  initialPicks,
  readOnly,
  alreadySubmitted,
}: {
  /** slot r32-N -> { home, away } a partir del pronóstico de grupos. */
  initialR32: Record<string, Pairing>;
  /** slot -> equipo ya elegido (borrador previo). */
  initialPicks: Record<string, string>;
  readOnly: boolean;
  alreadySubmitted: boolean;
}) {
  const router = useRouter();
  const [picks, setPicks] = useState<Record<string, string>>(
    () => ({ ...initialPicks })
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Emparejamientos de cada ronda. R32 viene dado; las demás se derivan de los
  // ganadores (picks) de la ronda anterior.
  const pairings = useMemo(() => {
    const byRound: Record<string, Pairing[]> = {};
    byRound["r32"] = R32_MATCHES.map(
      (m) => initialR32[m.id] ?? { home: null, away: null }
    );
    const order: BracketRound[] = ["r16", "qf", "sf", "final"];
    let prevRound: BracketRound = "r32";
    for (const r of order) {
      const size = ROUND_SIZES[r as Exclude<BracketRound, "champion">];
      const arr: Pairing[] = [];
      for (let i = 0; i < size; i++) {
        arr.push({
          home: picks[slotId(prevRound, i * 2)] ?? null,
          away: picks[slotId(prevRound, i * 2 + 1)] ?? null,
        });
      }
      byRound[r] = arr;
      prevRound = r;
    }
    return byRound;
  }, [initialR32, picks]);

  const totalSlots = 16 + 8 + 4 + 2 + 1; // sin contar champion
  const resolved = useMemo(() => {
    let n = 0;
    const rounds: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];
    for (const r of rounds) {
      const size =
        r === "final" ? 1 : ROUND_SIZES[r as Exclude<BracketRound, "champion">];
      for (let i = 0; i < size; i++) if (picks[slotId(r, i)]) n++;
    }
    return n;
  }, [picks]);

  const champion = picks["final"] ?? null;

  function pick(round: BracketRound, index: number, team: string | null) {
    if (readOnly || !team) return;
    const id = slotId(round, index);
    setPicks((prev) => {
      const next = { ...prev };
      if (next[id] === team) return prev;
      next[id] = team;
      invalidateDownstream(next, round, index);
      if (round === "final") next["champion"] = team;
      return next;
    });
  }

  async function send(submit: boolean) {
    setError(null);
    if (submit && resolved < totalSlots) {
      setError(
        `Completa todo el cuadro antes de enviar (${resolved}/${totalSlots} cruces).`
      );
      return;
    }
    const finalWinner = picks[slotId("final", 0)];
    const payloadPicks = Object.entries(picks)
      .filter(([slot]) => slot !== "champion")
      .map(([slot, team]) => ({ slot, round: roundOfSlot(slot), team }));
    if (finalWinner) {
      payloadPicks.push({
        slot: "champion",
        round: "champion",
        team: finalWinner,
      });
    }

    setBusy(true);
    const res = await fetch("/api/cuadro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submit, picks: payloadPicks }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Error al guardar.");
      return;
    }
    if (submit) {
      router.push("/");
      router.refresh();
    } else {
      setError("✓ Guardado como borrador.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">🏆 Tu cuadro hasta la final</h1>
        {readOnly ? (
          <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            {alreadySubmitted
              ? "Ya enviaste tu cuadro. Aquí lo ves (solo lectura)."
              : "El cuadro está cerrado para envíos."}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            El cuadro parte de tu pronóstico de grupos. Pulsa la bandera del
            equipo que avanza en cada cruce hasta coronar al campeón. Suma{" "}
            <b>1 punto por cada cruce acertado</b> (+1 por el campeón).
          </p>
        )}
      </div>

      {/* Progreso */}
      {!readOnly && (
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Cruces resueltos: {resolved}/{totalSlots}
            </span>
            {champion && (
              <span className="flex items-center gap-1 text-sm font-semibold">
                <Flag team={champion} /> {esName(champion)}
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${Math.round((resolved / totalSlots) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Árbol clásico */}
      <BracketTree
        pairings={pairings}
        picks={picks}
        readOnly={readOnly}
        onPick={pick}
      />

      {error && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            error.startsWith("✓")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="flex gap-3">
          <button
            onClick={() => send(false)}
            disabled={busy}
            className="rounded-lg border border-pitch px-4 py-2 font-semibold text-pitch transition hover:bg-pitch/5 disabled:opacity-50"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => send(true)}
            disabled={busy}
            className="rounded-lg bg-pitch px-4 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Enviando…" : "Enviar cuadro"}
          </button>
        </div>
      )}
    </div>
  );
}

// --- helpers ---

function roundOfSlot(slot: string): string {
  if (slot === "final") return "final";
  if (slot === "champion") return "champion";
  return slot.split("-")[0];
}

/**
 * Al cambiar el ganador de un cruce, limpia los picks de TODAS las rondas
 * posteriores (se recalcularán al elegir de nuevo). Conservador pero correcto.
 */
function invalidateDownstream(
  picks: Record<string, string>,
  round: BracketRound,
  index: number
) {
  const order: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];
  const ri = order.indexOf(round);
  for (let k = ri + 1; k < order.length; k++) {
    const r = order[k];
    const size =
      r === "final" ? 1 : ROUND_SIZES[r as Exclude<BracketRound, "champion">];
    for (let i = 0; i < size; i++) delete picks[slotId(r, i)];
  }
  delete picks["champion"];
  void index;
}
