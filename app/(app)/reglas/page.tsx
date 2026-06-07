import { scoringRules } from "@/lib/scoring";

export default function ReglasPage() {
  const rules = scoringRules();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">📖 Reglas y puntuación</h1>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold text-pitch">Cómo se puntúa</h2>
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between border-b pb-2 last:border-0"
            >
              <span>{r.label}</span>
              <span className="rounded-full bg-pitch px-3 py-1 text-sm font-semibold text-white">
                +{r.points} pts
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          El marcador exacto y el acierto de resultado no se suman entre sí: si
          aciertas el marcador exacto recibes esa puntuación (la mayor).
        </p>
      </section>

      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold text-pitch">Cómo funciona la porra</h2>
        <ol className="list-decimal space-y-2 pl-5 text-slate-700">
          <li>
            El Mundial 2026 tiene <b>6 fases</b>: fase de grupos, dieciseisavos
            (ronda de 32), octavos (ronda de 16), cuartos, semifinales y final.
          </li>
          <li>
            En cada fase rellenas tus marcadores. En la fase de grupos, la
            clasificación de cada grupo (y por tanto el orden final) se calcula
            sola a partir de tus resultados, con los criterios de desempate
            oficiales de la FIFA.
          </li>
          <li>
            Puedes <b>guardar borrador</b> las veces que quieras. Cuando
            <b> envías</b>, tu pronóstico queda bloqueado para esa fase.
          </li>
          <li>
            Cada fase tiene una <b>fecha límite</b> (justo antes de que empiece):
            pasada esa hora ya no se admiten envíos.
          </li>
          <li>
            Cada mañana se comprueban los resultados y se actualiza la
            clasificación automáticamente.
          </li>
        </ol>
      </section>
    </div>
  );
}
