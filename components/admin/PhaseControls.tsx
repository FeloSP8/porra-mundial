"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Phase } from "@/lib/types";

/** Convierte un ISO a valor de <input type="datetime-local"> (hora local). */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PhaseControls({ phase }: { phase: Phase }) {
  const router = useRouter();
  const [deadline, setDeadline] = useState(toLocalInput(phase.deadline));
  const [busy, setBusy] = useState(false);

  async function save(patch: { isOpen?: boolean; deadline?: string | null }) {
    setBusy(true);
    await fetch("/api/admin/fase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phaseId: phase.id, ...patch }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <div className="min-w-[10rem]">
        <p className="font-semibold">{phase.name}</p>
        <p className="text-xs text-slate-500">
          {phase.is_open ? "🟢 Abierta" : "🔴 Cerrada"}
        </p>
      </div>

      <input
        type="datetime-local"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <button
        disabled={busy}
        onClick={() =>
          save({ deadline: deadline ? new Date(deadline).toISOString() : null })
        }
        className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        Guardar fecha
      </button>

      <button
        disabled={busy}
        onClick={() => save({ isOpen: !phase.is_open })}
        className={`rounded px-3 py-1 text-sm font-medium text-white disabled:opacity-50 ${
          phase.is_open ? "bg-red-600" : "bg-green-600"
        }`}
      >
        {phase.is_open ? "Cerrar" : "Abrir"}
      </button>
    </div>
  );
}
