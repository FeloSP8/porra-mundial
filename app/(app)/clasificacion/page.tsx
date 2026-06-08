import { requireProfile } from "@/lib/auth";
import LeaderboardTable from "@/components/LeaderboardTable";

export default async function ClasificacionPage() {
  const me = await requireProfile();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🏆 Clasificación general</h1>
      <p className="text-slate-600">
        Puntos acumulados de todos los jugadores. Se actualiza cada mañana tras
        comprobar los resultados.
      </p>

      <LeaderboardTable currentUserId={me.id} />
    </div>
  );
}
