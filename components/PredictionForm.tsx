"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match } from "@/lib/types";
import Flag from "@/components/Flag";
import { esName } from "@/lib/flags";
import GroupStandings from "@/components/GroupStandings";
import type { TableMatch } from "@/lib/groupTable";

export type InitialPrediction = {
  match_id: number;
  pred_home: number;
  pred_away: number;
};

type Props = {
  phaseKey: string;
  phaseName: string;
  matches: Match[];
  /** true = la fase de grupos, mostramos las tablas de clasificación */
  isGroupPhase: boolean;
  /** equipos por grupo, { A: [team,...], ... } */
  groupsTeams: Record<string, string[]>;
  initialPredictions: InitialPrediction[];
  /** true = ya enviado o fase cerrada → solo lectura */
  readOnly: boolean;
  alreadySubmitted: boolean;
};

export default function PredictionForm({
  phaseKey,
  phaseName,
  matches,
  isGroupPhase,
  groupsTeams,
  initialPredictions,
  readOnly,
  alreadySubmitted,
}: Props) {
  const router = useRouter();

  // Estado de marcadores: matchId -> { home, away } (como strings para el input)
  const [scores, setScores] = useState<
    Record<number, { home: string; away: string }>
  >(() => {
    const init: Record<number, { home: string; away: string }> = {};
    for (const m of matches) {
      const p = initialPredictions.find((ip) => ip.match_id === m.id);
      init[m.id] = {
        home: p ? String(p.pred_home) : "",
        away: p ? String(p.pred_away) : "",
      };
    }
    return init;
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Agrupar partidos por grupo (grupos) o mostrarlos en lista (eliminatorias)
  const matchesByGroup = useMemo(() => {
    const map: Record<string, Match[]> = {};
    for (const m of matches) {
      const key = m.group_label ?? "—";
      (map[key] ??= []).push(m);
    }
    return map;
  }, [matches]);

  const groupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const m of matches) {
      if (m.group_label) keys.add(m.group_label);
    }
    return Array.from(keys).sort();
  }, [matches]);

  const [activeGroup, setActiveGroup] = useState<string>(() => {
    if (isGroupPhase) {
      return "A";
    }
    return "—";
  });

  const filledCount = useMemo(
    () =>
      matches.filter(
        (m) => scores[m.id]?.home !== "" && scores[m.id]?.away !== ""
      ).length,
    [matches, scores]
  );
  const allMatchesFilled = filledCount === matches.length;

  function setScore(matchId: number, side: "home" | "away", value: string) {
    const clean = value.replace(/[^0-9]/g, "").slice(0, 2);
    setScores((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: clean },
    }));
  }

  // Partidos de un grupo como TableMatch[] (con los marcadores actuales),
  // para alimentar la tabla de clasificación en vivo.
  function tableMatchesForGroup(groupLabel: string): TableMatch[] {
    return matches
      .filter((m) => m.group_label === groupLabel)
      .map((m) => {
        const s = scores[m.id];
        const home = s?.home !== "" ? Number(s.home) : null;
        const away = s?.away !== "" ? Number(s.away) : null;
        return {
          home_team: m.home_team,
          away_team: m.away_team,
          home_score: home,
          away_score: away,
        };
      });
  }

  async function send(submit: boolean) {
    setError(null);

    if (submit && !allMatchesFilled) {
      setError("Rellena todos los marcadores antes de enviar.");
      return;
    }

    setBusy(true);
    const payload = {
      phaseKey,
      submit,
      matches: matches
        .filter((m) => scores[m.id]?.home !== "" && scores[m.id]?.away !== "")
        .map((m) => ({
          matchId: m.id,
          predHome: Number(scores[m.id].home),
          predAway: Number(scores[m.id].away),
        })),
    };

    const res = await fetch("/api/predicciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "Error al guardar.");
      return;
    }
    if (submit) {
      router.push("/predicciones");
      router.refresh();
    } else {
      setError("✓ Guardado como borrador.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{phaseName}</h1>
        {readOnly ? (
          <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            {alreadySubmitted
              ? "Ya enviaste esta fase. Aquí ves tu pronóstico (solo lectura)."
              : "Esta fase está cerrada para envíos."}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            Rellena los marcadores. Puedes <b>guardar borrador</b> y volver, o{" "}
            <b>enviar</b> cuando termines (al enviar ya no se puede editar).
            {isGroupPhase && (
              <> La clasificación de cada grupo se calcula sola con tus resultados.</>
            )}
          </p>
        )}
      </div>

      {/* PROGRESO (útil sobre todo en grupos, con 72 partidos) */}
      {!readOnly && (
        <div className="sticky top-0 z-10 rounded-xl border bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Marcadores: {filledCount}/{matches.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-pitch transition-all"
              style={{
                width: `${
                  matches.length
                    ? Math.round((filledCount / matches.length) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* SELECTOR DE GRUPOS (solo para fase de grupos) */}
      {isGroupPhase && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {groupKeys.map((gk) => {
            const isActive = activeGroup === gk;
            const groupMatches = matchesByGroup[gk] ?? [];
            const groupFilledCount = groupMatches.filter(
              (m) => scores[m.id]?.home !== "" && scores[m.id]?.away !== ""
            ).length;
            const groupAllFilled = groupFilledCount === groupMatches.length;

            return (
              <button
                key={gk}
                onClick={() => setActiveGroup(gk)}
                type="button"
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition whitespace-nowrap border ${
                  isActive
                    ? "bg-pitch text-white border-pitch shadow-sm"
                    : groupAllFilled
                    ? "bg-green-50 text-emerald-800 border-emerald-200"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Grupo {gk}
                {groupFilledCount > 0 && (
                  <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}>
                    {groupFilledCount}/{groupMatches.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* MARCADORES + (en grupos) tabla de clasificación en vivo por grupo */}
      {Object.entries(matchesByGroup).map(([groupKey, ms]) => {
        // En fase de grupos, solo mostrar el grupo activo
        if (isGroupPhase && groupKey !== activeGroup) return null;

        return (
          <section key={groupKey} className="rounded-xl border bg-white p-4">
            {groupKey !== "—" && (
              <h2 className="mb-3 font-semibold text-pitch">Grupo {groupKey}</h2>
            )}
            <ul className="space-y-3.5">
              {ms.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-1 sm:gap-2">
                  <span className="flex-1 flex items-center justify-end gap-1.5 text-sm min-w-0 text-right">
                    <span className="truncate" title={esName(m.home_team)}>
                      {esName(m.home_team)}
                    </span>
                    <Flag team={m.home_team} className="flex-shrink-0" />
                  </span>

                  <div className="flex-shrink-0 flex items-center gap-1 mx-1.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={readOnly}
                      value={scores[m.id]?.home ?? ""}
                      onChange={(e) => setScore(m.id, "home", e.target.value)}
                      className="w-12 h-9 rounded border border-slate-300 px-1 text-center text-base disabled:bg-slate-100 focus:border-pitch focus:ring-1 focus:ring-pitch focus:outline-none transition"
                    />
                    <span className="text-slate-400 font-semibold">-</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      disabled={readOnly}
                      value={scores[m.id]?.away ?? ""}
                      onChange={(e) => setScore(m.id, "away", e.target.value)}
                      className="w-12 h-9 rounded border border-slate-300 px-1 text-center text-base disabled:bg-slate-100 focus:border-pitch focus:ring-1 focus:ring-pitch focus:outline-none transition"
                    />
                  </div>

                  <span className="flex-1 flex items-center justify-start gap-1.5 text-sm min-w-0 text-left">
                    <Flag team={m.away_team} className="flex-shrink-0" />
                    <span className="truncate" title={esName(m.away_team)}>
                      {esName(m.away_team)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Clasificación en vivo del grupo (solo fase de grupos) */}
            {isGroupPhase && groupKey !== "—" && groupsTeams[groupKey] && (
              <div className="mt-4 border-t pt-3">
                <GroupStandings
                  label={groupKey}
                  teams={groupsTeams[groupKey]}
                  matches={tableMatchesForGroup(groupKey)}
                />
              </div>
            )}
          </section>
        );
      })}

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
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => send(false)}
            disabled={busy}
            className="w-full sm:w-auto rounded-lg border border-pitch px-4 py-2.5 font-semibold text-pitch transition hover:bg-pitch/5 disabled:opacity-50 text-center"
          >
            Guardar borrador
          </button>
          <button
            onClick={() => send(true)}
            disabled={busy}
            className="w-full sm:w-auto rounded-lg bg-pitch px-4 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50 text-center"
          >
            {busy ? "Enviando…" : "Enviar pronóstico"}
          </button>
        </div>
      )}
    </div>
  );
}
