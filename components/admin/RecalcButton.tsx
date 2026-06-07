"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecalcButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function recalc() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/recalcular", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setMsg(
      res.ok
        ? `✓ Recalculado. Predicciones actualizadas: ${data.recalc?.predictionsUpdated ?? 0}.`
        : `Error: ${data.error}`
    );
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={recalc}
        disabled={busy}
        className="rounded-lg bg-pitch px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Recalculando…" : "Recalcular puntos ahora"}
      </button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}
