"use client";

import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import TrophySvg from "@/components/TrophySvg";
import { slotId, type BracketRound } from "@/lib/bracket";

export type Pairing = { home: string | null; away: string | null };

/**
 * Árbol clásico de torneo (estilo bracket de Champions).
 *
 * Aprovecha que R32_MATCHES está ordenado en pares consecutivos: los cruces
 * 0–7 forman la media-llave IZQUIERDA y los 8–15 la DERECHA; ambas convergen
 * en la final del centro.
 *
 * Mobile-first y compacto: cada equipo es solo su bandera (nombre en title).
 * Si no se pasa onPick o readOnly=true, las banderas no son clicables.
 */
export default function BracketTree({
  pairings,
  picks,
  readOnly,
  onPick,
}: {
  /** ronda -> array de cruces { home, away } */
  pairings: Record<string, Pairing[]>;
  /** slot -> equipo elegido como ganador del cruce */
  picks: Record<string, string>;
  readOnly: boolean;
  onPick?: (round: BracketRound, index: number, team: string | null) => void;
}) {
  // Rondas de cada lado, de fuera hacia dentro.
  const leftRounds: { round: BracketRound; from: number; count: number }[] = [
    { round: "r32", from: 0, count: 8 },
    { round: "r16", from: 0, count: 4 },
    { round: "qf", from: 0, count: 2 },
    { round: "sf", from: 0, count: 1 },
  ];
  const rightRounds: { round: BracketRound; from: number; count: number }[] = [
    { round: "sf", from: 1, count: 1 },
    { round: "qf", from: 2, count: 2 },
    { round: "r16", from: 4, count: 4 },
    { round: "r32", from: 8, count: 8 },
  ];

  const finalPair = pairings["final"]?.[0] ?? { home: null, away: null };
  const champion = picks["final"] ?? null;

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex items-stretch justify-center gap-1 sm:gap-2 min-w-[340px]">
        {/* Media-llave izquierda */}
        {leftRounds.map((col) => (
          <RoundColumn
            key={`L-${col.round}`}
            side="left"
            round={col.round}
            from={col.from}
            count={col.count}
            pairings={pairings}
            picks={picks}
            readOnly={readOnly}
            onPick={onPick}
          />
        ))}

        {/* Centro: final + trofeo */}
        <div className="flex flex-col items-center justify-center px-1">
          <TrophySvg size={40} />
          <div className="my-1 flex flex-col gap-1 rounded-lg border border-gold bg-yellow-50 p-1.5">
            <TeamCell
              team={finalPair.home}
              selected={champion === finalPair.home && !!finalPair.home}
              readOnly={readOnly}
              onClick={() => onPick?.("final", 0, finalPair.home)}
            />
            <TeamCell
              team={finalPair.away}
              selected={champion === finalPair.away && !!finalPair.away}
              readOnly={readOnly}
              onClick={() => onPick?.("final", 0, finalPair.away)}
            />
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Final
          </p>
          {champion && (
            <div className="mt-1 flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5">
              <Flag team={champion} />
              <span className="text-[11px] font-bold">{esName(champion)}</span>
            </div>
          )}
        </div>

        {/* Media-llave derecha */}
        {rightRounds.map((col) => (
          <RoundColumn
            key={`R-${col.round}`}
            side="right"
            round={col.round}
            from={col.from}
            count={col.count}
            pairings={pairings}
            picks={picks}
            readOnly={readOnly}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

/** Una columna (ronda) de una media-llave, con sus cruces repartidos. */
function RoundColumn({
  side,
  round,
  from,
  count,
  pairings,
  picks,
  readOnly,
  onPick,
}: {
  side: "left" | "right";
  round: BracketRound;
  from: number;
  count: number;
  pairings: Record<string, Pairing[]>;
  picks: Record<string, string>;
  readOnly: boolean;
  onPick?: (round: BracketRound, index: number, team: string | null) => void;
}) {
  const roundPairs = pairings[round] ?? [];
  const indices = Array.from({ length: count }, (_, k) => from + k);

  return (
    <div className="flex flex-col justify-around gap-1.5">
      {indices.map((idx) => {
        const pair = roundPairs[idx] ?? { home: null, away: null };
        const chosen = picks[slotId(round, idx)] ?? null;
        return (
          <div
            key={`${round}-${idx}`}
            className={`flex flex-col gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 ${
              side === "left" ? "items-start" : "items-end"
            }`}
          >
            <TeamCell
              team={pair.home}
              selected={chosen === pair.home && !!pair.home}
              readOnly={readOnly}
              onClick={() => onPick?.(round, idx, pair.home)}
            />
            <TeamCell
              team={pair.away}
              selected={chosen === pair.away && !!pair.away}
              readOnly={readOnly}
              onClick={() => onPick?.(round, idx, pair.away)}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Celda de un equipo: solo la bandera (compacta). Botón si es editable. */
function TeamCell({
  team,
  selected,
  readOnly,
  onClick,
}: {
  team: string | null;
  selected: boolean;
  readOnly: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return (
      <span
        className="inline-flex h-5 w-7 items-center justify-center rounded-sm border border-dashed border-slate-200 text-[9px] text-slate-300"
        aria-label="Por definir"
      >
        ?
      </span>
    );
  }
  const inner = (
    <Flag
      team={team}
      className={selected ? "ring-2 ring-pitch rounded-sm" : ""}
    />
  );
  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center rounded-sm p-0.5 ${
          selected ? "bg-pitch/10" : ""
        }`}
        title={esName(team)}
      >
        {inner}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={esName(team)}
      aria-label={esName(team)}
      className={`inline-flex items-center rounded-sm p-0.5 transition hover:bg-slate-100 ${
        selected ? "bg-pitch/10" : ""
      }`}
    >
      {inner}
    </button>
  );
}
