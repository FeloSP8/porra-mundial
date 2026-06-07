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

  // Agrupar partidos por grupo (grupos) o mostrarlos en lista (eliminatorias)
  const matchesByGroup = useMemo(() => {
    const map: Record<string, Match[]> = {};
    for (const m of matches) {
      const key = m.group_label ?? "—";
      (map[key] ??= []).push(m);
    }
    return map;
  }, [matches]);

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

      {/* MARCADORES + (en grupos) tabla de clasificación en vivo por grupo */}
      {Object.entries(matchesByGroup).map(([groupKey, ms]) => (
        <section key={groupKey} className="rounded-xl border bg-white p-4">
          {groupKey !== "—" && (
            <h2 className="mb-3 font-semibold text-pitch">Grupo {groupKey}</h2>
          )}
          <ul className="space-y-2">
            {ms.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2">
                <span className="flex w-2/5 items-center justify-end gap-1.5 text-sm">
                  <span className="truncate">{esName(m.home_team)}</span>
                  <Flag team={m.home_team} />
                </span>
                <div className="flex items-center gap-1">
                  <input
                    inputMode="numeric"
                    disabled={readOnly}
                    value={scores[m.id]?.home ?? ""}
                    onChange={(e) => setScore(m.id, "home", e.target.value)}
                    className="w-10 rounded border border-slate-300 px-2 py-1 text-center disabled:bg-slate-100"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    inputMode="numeric"
                    disabled={readOnly}
                    value={scores[m.id]?.away ?? ""}
                    onChange={(e) => setScore(m.id, "away", e.target.value)}
                    className="w-10 rounded border border-slate-300 px-2 py-1 text-center disabled:bg-slate-100"
                  />
                </div>
                <span className="flex w-2/5 items-center justify-start gap-1.5 text-sm">
                  <Flag team={m.away_team} />
                  <span className="truncate">{esName(m.away_team)}</span>
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
      ))}

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
            {busy ? "Enviando…" : "Enviar pronóstico"}
          </button>
        </div>
      )}
    </div>
  );
}
