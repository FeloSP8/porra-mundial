"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Botón que fuerza AHORA el proceso completo de actualización (igual que el
 * cron diario): trae resultados de football-data, actualiza marcadores y
 * recalcula la clasificación y los puntos.
 */
export default function UpdateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function update() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/actualizar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error ?? "no se pudo actualizar"}`);
      } else if (data.footballDataError) {
        setMsg(
          `⚠️ football-data falló (${data.footballDataError}). Se recalculó con lo que hay en la BD.`
        );
      } else {
        const cal = data.calendar ?? {};
        const rec = data.recalc ?? {};
        setMsg(
          `✓ Actualizado. Partidos actualizados: ${cal.updated ?? 0}, nuevos: ${
            cal.created ?? 0
          }. Predicciones repuntuadas: ${rec.predictionsUpdated ?? 0}.`
        );
      }
    } catch (e: any) {
      setMsg(`Error: ${e?.message ?? e}`);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={update}
        disabled={busy}
        className="rounded-lg bg-pitch px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Actualizando…" : "Actualizar resultados ahora"}
      </button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}
