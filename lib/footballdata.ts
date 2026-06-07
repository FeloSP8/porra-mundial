// ============================================================================
//  Cliente de football-data.org (API v4) — free tier.
//  Docs: https://docs.football-data.org/general/v4/index.html
//  Competición Mundial: código "WC".
// ============================================================================

import { FOOTBALL_DATA_COMPETITION } from "./constants";

const BASE = "https://api.football-data.org/v4";

export type FDMatch = {
  id: number;
  stage: string; // GROUP_STAGE, LAST_32, ...
  group: string | null; // "GROUP_A" | null
  matchday: number | null;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  utcDate: string;
  homeTeam: { name: string | null; shortName: string | null };
  awayTeam: { name: string | null; shortName: string | null };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
};

function token(): string {
  const t = process.env.FOOTBALL_DATA_TOKEN;
  if (!t) throw new Error("Falta FOOTBALL_DATA_TOKEN");
  return t;
}

/** Convierte "GROUP_A" -> "A". Devuelve null si no es un grupo. */
export function groupLabelOf(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/GROUP_([A-L])/);
  return m ? m[1] : null;
}

/** Nombre limpio de equipo (prefiere shortName si existe). */
export function teamName(t: {
  name: string | null;
  shortName: string | null;
}): string {
  return t.shortName ?? t.name ?? "—";
}

/**
 * Trae los partidos del Mundial. Por defecto todos; pasa status para filtrar
 * (ej. "FINISHED"). Maneja errores devolviendo un objeto con `ok`.
 */
export async function fetchMatches(
  status?: string
): Promise<{ ok: true; matches: FDMatch[] } | { ok: false; error: string }> {
  const url = new URL(
    `${BASE}/competitions/${FOOTBALL_DATA_COMPETITION}/matches`
  );
  if (status) url.searchParams.set("status", status);

  try {
    const res = await fetch(url.toString(), {
      headers: { "X-Auth-Token": token() },
      // sin caché: queremos datos frescos en cada ejecución del cron
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `football-data respondió ${res.status} ${res.statusText}`,
      };
    }
    const data = await res.json();
    return { ok: true, matches: (data.matches ?? []) as FDMatch[] };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error de red" };
  }
}
