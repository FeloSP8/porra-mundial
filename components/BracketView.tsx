"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import TrophySvg from "@/components/TrophySvg";
import {
  R32_MATCHES,
  ROUND_SIZES,
  slotId,
  type BracketRound,
} from "@/lib/bracket";

type Pairing = { home: string | null; away: string | null };

const ROUND_LABELS: Record<BracketRound, string> = {
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos",
  sf: "Semifinales",
  final: "Final",
  champion: "Campeón",
};

const PLAYABLE_ROUNDS: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];

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
  const [activeRound, setActiveRound] = useState<BracketRound>("r32");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Emparejamientos de cada ronda. R32 viene dado; las demás se derivan de los
  // ganadores (picks) de la ronda anterior.
  const pairings = useMemo(() => {
    const byRound: Record<string, Pairing[]> = {};
    // R32
    byRound["r32"] = R32_MATCHES.map((m) => initialR32[m.id] ?? { home: null, away: null });
    // Resto
    const order: BracketRound[] = ["r16", "qf", "sf", "final"];
    let prevRound: BracketRound = "r32";
    for (const r of order) {
      const size = ROUND_SIZES[r as Exclude<BracketRound, "champion">];
      const prev = byRound[prevRound];
      const arr: Pairing[] = [];
      for (let i = 0; i < size; i++) {
        const homeSlot = slotId(prevRound, i * 2);
        const awaySlot = slotId(prevRound, i * 2 + 1);
        arr.push({
          home: picks[homeSlot] ?? null,
          away: picks[awaySlot] ?? null,
        });
        void prev;
      }
      byRound[r] = arr;
      prevRound = r;
    }
    return byRound;
  }, [initialR32, picks]);

  // Total de cruces resueltos (para el progreso).
  const totalSlots = 16 + 8 + 4 + 2 + 1; // sin contar champion
  const resolved = useMemo(() => {
    let n = 0;
    for (const r of PLAYABLE_ROUNDS) {
      const size =
        r === "final" ? 1 : ROUND_SIZES[r as Exclude<BracketRound, "champion">];
      for (let i = 0; i < size; i++) {
        if (picks[slotId(r, i)]) n++;
      }
    }
    return n;
  }, [picks]);

  const champion = picks["champion"] ?? picks["final"] ?? null;

  function pick(round: BracketRound, index: number, team: string | null) {
    if (readOnly || !team) return;
    const id = slotId(round, index);
    setPicks((prev) => {
      const next = { ...prev };
      if (next[id] === team) return prev; // sin cambios
      next[id] = team;
      // Al cambiar un ganador, invalidar los picks dependientes aguas abajo
      // que dependían del valor anterior (se recalculan al re-render; aquí solo
      // limpiamos picks de rondas siguientes que ya no sean válidos).
      invalidateDownstream(next, round, index);
      // El campeón es el ganador de la final.
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
    // Asegurar champion = ganador de la final.
    const finalWinner = picks[slotId("final", 0)];
    const payloadPicks = Object.entries(picks)
      .filter(([slot]) => slot !== "champion")
      .map(([slot, team]) => ({
        slot,
        round: roundOfSlot(slot),
        team,
      }));
    if (finalWinner) {
      payloadPicks.push({ slot: "champion", round: "champion", team: finalWinner });
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

  const isFinal = activeRound === "final";

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
            El cuadro parte de tu pronóstico de grupos. Elige quién avanza en
            cada cruce hasta coronar al campeón. Suma <b>1 punto por cada cruce
            acertado</b> (+1 por el campeón), aparte de lo demás.
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

      {/* Selector de ronda */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {PLAYABLE_ROUNDS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRound(r)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                activeRound === r
                  ? "bg-pitch text-white border-pitch shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {ROUND_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Final destacada con trofeo */}
      {isFinal && (
        <div className="flex flex-col items-center gap-1 py-2">
          <TrophySvg size={72} />
          <p className="text-sm font-semibold text-slate-700">
            El ganador de la final será tu campeón
          </p>
        </div>
      )}

      {/* Cruces de la ronda activa */}
      <div className="space-y-3">
        {pairings[activeRound]?.map((pair, i) => {
          const id = slotId(activeRound, i);
          const chosen = picks[id] ?? null;
          return (
            <div
              key={id}
              className={`rounded-xl border bg-white p-2 ${
                isFinal ? "border-gold shadow-sm" : ""
              }`}
            >
              <p className="mb-1 px-1 text-[11px] text-slate-400">
                {ROUND_LABELS[activeRound]} · cruce {i + 1}
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                <TeamButton
                  team={pair.home}
                  selected={chosen === pair.home && !!pair.home}
                  disabled={readOnly}
                  onClick={() => pick(activeRound, i, pair.home)}
                />
                <TeamButton
                  team={pair.away}
                  selected={chosen === pair.away && !!pair.away}
                  disabled={readOnly}
                  onClick={() => pick(activeRound, i, pair.away)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Campeón */}
      {champion && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gold bg-yellow-50 p-4">
          <TrophySvg size={40} />
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Tu campeón
            </p>
            <p className="flex items-center gap-2 text-lg font-bold">
              <Flag team={champion} /> {esName(champion)}
            </p>
          </div>
        </div>
      )}

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

function TeamButton({
  team,
  selected,
  disabled,
  onClick,
}: {
  team: string | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400">
        Por definir
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-pitch bg-pitch/10 font-semibold"
          : "border-slate-200 hover:bg-slate-50"
      } ${disabled ? "cursor-default" : ""}`}
    >
      <Flag team={team} className="flex-shrink-0" />
      <span className="truncate">{esName(team)}</span>
      {selected && <span className="ml-auto text-pitch">✓</span>}
    </button>
  );
}

// --- helpers ---

function roundOfSlot(slot: string): string {
  if (slot === "final") return "final";
  if (slot === "champion") return "champion";
  return slot.split("-")[0];
}

/**
 * Cuando cambia el ganador de un cruce, los cruces de rondas posteriores que
 * tenían colocado al equipo perdedor dejan de ser válidos. Limpia esos picks
 * aguas abajo de forma sencilla: elimina cualquier pick de ronda posterior cuyo
 * equipo ya no esté presente en los emparejamientos derivados. Como recalcular
 * el árbol completo aquí es costoso, hacemos una limpieza conservadora: borrar
 * los picks de TODAS las rondas posteriores al cruce cambiado.
 */
function invalidateDownstream(
  picks: Record<string, string>,
  round: BracketRound,
  index: number
) {
  const order: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];
  const ri = order.indexOf(round);
  // Borra picks de rondas estrictamente posteriores.
  for (let k = ri + 1; k < order.length; k++) {
    const r = order[k];
    const size =
      r === "final" ? 1 : ROUND_SIZES[r as Exclude<BracketRound, "champion">];
    for (let i = 0; i < size; i++) {
      delete picks[slotId(r, i)];
    }
  }
  delete picks["champion"];
  void index;
}
