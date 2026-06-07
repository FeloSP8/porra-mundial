import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";

export default async function PrediccionesIndex() {
  const profile = await requireProfile();
  const supabase = createClient();

  const { data: phases } = await supabase
    .from("phases")
    .select("*")
    .order("order");

  const { data: subs } = await supabase
    .from("submissions")
    .select("phase_id")
    .eq("user_id", profile.id);
  const submitted = new Set((subs ?? []).map((s) => s.phase_id));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mis pronósticos</h1>
      <p className="text-slate-600">
        El Mundial tiene 6 fases. En cada una envías tu pronóstico una vez.
      </p>

      <ul className="space-y-3">
        {(phases ?? []).map((phase: Phase) => {
          const accepts = phaseAcceptsSubmissions(phase);
          const isSubmitted = submitted.has(phase.id);
          let badge: { text: string; cls: string };
          if (isSubmitted) {
            badge = { text: "Enviado ✓", cls: "bg-green-100 text-green-800" };
          } else if (accepts) {
            badge = { text: "Abierta", cls: "bg-yellow-100 text-yellow-800" };
          } else {
            badge = { text: "Cerrada", cls: "bg-slate-100 text-slate-500" };
          }

          const clickable = accepts || isSubmitted;
          const inner = (
            <div
              className={`flex items-center justify-between rounded-xl border bg-white p-4 ${
                clickable ? "transition hover:shadow" : "opacity-60"
              }`}
            >
              <div>
                <p className="font-semibold">
                  {phase.order}. {phase.name}
                </p>
                {phase.deadline && (
                  <p className="text-xs text-slate-500">
                    Cierre:{" "}
                    {new Date(phase.deadline).toLocaleString("es-ES", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${badge.cls}`}
              >
                {badge.text}
              </span>
            </div>
          );

          return (
            <li key={phase.id}>
              {clickable ? (
                <Link href={`/predicciones/${phase.key}`}>{inner}</Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
