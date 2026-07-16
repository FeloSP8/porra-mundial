import type { ReactNode } from "react";

export type CronRun = {
  id: number;
  ran_at: string;
  source: string;
  ok: boolean;
  duration_ms: number | null;
  football_data_error: string | null;
  error: string | null;
  summary: Record<string, any> | null;
};

/** Fecha/hora en zona de España. */
function fmt(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  });
}

/** Estado de una ejecución: OK / parcial (football-data) / fallo. */
function status(r: CronRun): { label: string; cls: string } {
  if (r.error) return { label: "❌ Fallo", cls: "bg-red-100 text-red-800" };
  if (r.football_data_error)
    return { label: "⚠️ Parcial", cls: "bg-amber-100 text-amber-800" };
  return { label: "✓ OK", cls: "bg-green-100 text-green-800" };
}

/** Resumen corto de contadores del log. */
function summaryChips(s: Record<string, any> | null): ReactNode {
  if (!s) return null;
  const cal = s.calendar ?? {};
  const rec = s.recalc ?? {};
  const chips: string[] = [];
  if (cal.created || cal.updated)
    chips.push(`partidos +${cal.created ?? 0}/~${cal.updated ?? 0}`);
  if (s.autoOpen?.phasesOpened) chips.push(`fases abiertas ${s.autoOpen.phasesOpened}`);
  if (s.autoClose?.phasesClosed) chips.push(`fases cerradas ${s.autoClose.phasesClosed}`);
  if (s.autoClose?.playersPenalized)
    chips.push(`penalizados ${s.autoClose.playersPenalized}`);
  if (rec.predictionsUpdated) chips.push(`predicciones ${rec.predictionsUpdated}`);
  if (s.bracket?.bracketRowsUpdated)
    chips.push(`cuadro ${s.bracket.bracketRowsUpdated}`);
  if (chips.length === 0) chips.push("sin cambios");
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span
          key={i}
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export default function CronRuns({ runs }: { runs: CronRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4 text-sm text-slate-600">
        Aún no hay ejecuciones registradas. La primera aparecerá tras el próximo
        cron de las 08:00 (hora de España) o al pulsar “Actualizar resultados”.
      </div>
    );
  }

  const last = runs[0];
  const st = status(last);

  return (
    <div className="space-y-3">
      {/* Última ejecución, destacada. */}
      <div className="rounded-lg border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
            {st.label}
          </span>
          <span className="text-sm font-semibold">Última: {fmt(last.ran_at)}</span>
          <span className="text-xs text-slate-500">
            ({last.source === "cron" ? "automática" : "manual"}
            {last.duration_ms != null && `, ${(last.duration_ms / 1000).toFixed(1)}s`})
          </span>
        </div>
        {last.football_data_error && (
          <p className="mt-1 text-xs text-amber-700">
            football-data falló: {last.football_data_error}
          </p>
        )}
        {last.error && (
          <p className="mt-1 text-xs text-red-700">Error: {last.error}</p>
        )}
        {summaryChips(last.summary)}
      </div>

      {/* Historial reciente. */}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Cuándo</th>
              <th className="px-3 py-2">Origen</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 text-right">Duración</th>
              <th className="px-3 py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const s = status(r);
              return (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {fmt(r.ran_at)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.source === "cron" ? "auto" : "manual"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                    {r.duration_ms != null
                      ? `${(r.duration_ms / 1000).toFixed(1)}s`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.football_data_error && (
                      <p className="text-xs text-amber-700">
                        football-data: {r.football_data_error}
                      </p>
                    )}
                    {r.error && (
                      <p className="text-xs text-red-700">{r.error}</p>
                    )}
                    {summaryChips(r.summary)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
