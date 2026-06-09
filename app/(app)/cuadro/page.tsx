import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { phaseAcceptsSubmissions, type Phase } from "@/lib/types";
import { loadPlayerBracket } from "@/lib/bracketData";
import BracketView from "@/components/BracketView";

export const dynamic = "force-dynamic";

export default async function CuadroPage({
  searchParams,
}: {
  searchParams: { jugador?: string };
}) {
  const profile = await requireProfile();
  const supabase = createClient();

  // Fase virtual 'bracket'.
  const { data: phase } = await supabase
    .from("phases")
    .select("*")
    .eq("key", "bracket")
    .single<Phase>();

  if (!phase) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-bold">Cuadro completo</h1>
        <p className="mt-2 text-slate-600">
          La modalidad de cuadro aún no está activada. (Falta aplicar la
          migración en la base de datos.)
        </p>
      </div>
    );
  }

  const bracketClosed = !phaseAcceptsSubmissions(phase);

  // ¿Quién ha enviado el cuadro? (para privacidad).
  const { data: subsRaw } = await supabase
    .from("submissions")
    .select("user_id")
    .eq("phase_id", phase.id);
  const submittedSet = new Set((subsRaw ?? []).map((s) => s.user_id));
  const iSubmitted = submittedSet.has(profile.id);

  // Jugadores.
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");
  const players = (profilesRaw ?? []) as { id: string; display_name: string }[];

  // ¿Puedo ver el cuadro de un jugador dado?
  //  - el mío: siempre
  //  - de otro: si la fase está cerrada, o si yo envié y él también
  function canSee(userId: string): boolean {
    if (userId === profile.id) return true;
    if (bracketClosed) return true;
    return iSubmitted && submittedSet.has(userId);
  }

  // Jugador seleccionado (por query, por defecto yo).
  const selectedId =
    searchParams?.jugador &&
    players.some((p) => p.id === searchParams.jugador)
      ? searchParams.jugador
      : profile.id;
  const selectedPlayer = players.find((p) => p.id === selectedId)!;
  const isSelf = selectedId === profile.id;

  // Selector de jugadores (chips). El propio + los demás (con candado si oculto).
  const selector = players.length > 1 && (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none sm:flex-wrap sm:overflow-x-visible sm:mx-0 sm:px-0">
        {players.map((p) => {
          const visible = canSee(p.id);
          const active = p.id === selectedId;
          const label = p.id === profile.id ? "Tú" : p.display_name;
          return (
            <Link
              key={p.id}
              href={`/cuadro?jugador=${p.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                active
                  ? "bg-pitch text-white border-pitch shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
              {!visible && <span className="ml-1 text-xs">🔒</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  // Si no puedo ver el cuadro del jugador seleccionado.
  if (!canSee(selectedId)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">🏆 Cuadro completo</h1>
        {selector}
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          El cuadro de <b>{selectedPlayer.display_name}</b> se mostrará cuando
          cierre el plazo del cuadro
          {!iSubmitted && <> (o cuando tú y esa persona hayáis enviado el vuestro)</>}
          .
        </div>
      </div>
    );
  }

  // Cargar el cuadro del jugador seleccionado.
  const { hasGroups, initialR32, picks } = await loadPlayerBracket(
    supabase,
    selectedId
  );

  // El cuadro propio es editable mientras la fase acepte envíos y no haya
  // enviado; el de otros siempre es solo lectura.
  const iAlreadySubmitted = submittedSet.has(profile.id);
  const readOnly = !isSelf || iAlreadySubmitted || bracketClosed;

  if (!hasGroups) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">🏆 Cuadro completo</h1>
        {selector}
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          {isSelf ? (
            <>
              El cuadro se construye a partir de tu pronóstico de la{" "}
              <b>fase de grupos</b>. Primero rellena los marcadores de grupos y
              luego vuelve aquí.
              <div className="mt-3">
                <Link
                  href="/predicciones/groups"
                  className="inline-block rounded-lg bg-pitch px-4 py-2 font-semibold text-white hover:opacity-90"
                >
                  Ir a la fase de grupos
                </Link>
              </div>
            </>
          ) : (
            <>
              {selectedPlayer.display_name} aún no ha rellenado su pronóstico de
              grupos, así que su cuadro todavía no existe.
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selector}
      {!isSelf && (
        <p className="text-sm text-slate-500">
          Viendo el cuadro de <b>{selectedPlayer.display_name}</b>.
        </p>
      )}
      <BracketView
        key={selectedId /* remonta el componente al cambiar de jugador, así
                            no arrastra el estado picks del jugador anterior */}
        initialR32={initialR32}
        initialPicks={picks}
        readOnly={readOnly}
        alreadySubmitted={isSelf && iAlreadySubmitted}
      />
    </div>
  );
}
