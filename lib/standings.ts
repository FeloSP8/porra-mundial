// ============================================================================
//  Clasificación general — fuente única, reutilizada por la tabla de la home,
//  el banner de ganador y las estadísticas finales.
// ============================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { SCORING } from "./scoring";

export type StandingRow = {
  user_id: string;
  display_name: string;
  matchPoints: number;
  groupPoints: number;
  bracketPoints: number;
  penaltyPoints: number;
  exactCount: number; // marcadores exactos (desempate)
  total: number;
};

/**
 * Suma de puntos por partidos + orden de grupos + cuadro − penalizaciones.
 * Orden: total desc → más marcadores exactos → alfabético (estable).
 */
export async function computeStandings(
  supabase: SupabaseClient
): Promise<StandingRow[]> {
  const [
    { data: profiles },
    { data: preds },
    { data: gsp },
    { data: bracket },
    { data: penalties },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("predictions").select("user_id, points_awarded"),
    supabase.from("group_standings_predictions").select("user_id, points_awarded"),
    supabase.from("bracket_predictions").select("user_id, points_awarded"),
    supabase.from("phase_penalties").select("user_id, points"),
  ]);

  const rows: Record<string, StandingRow> = {};
  for (const p of profiles ?? []) {
    rows[p.id] = {
      user_id: p.id,
      display_name: p.display_name,
      matchPoints: 0,
      groupPoints: 0,
      bracketPoints: 0,
      penaltyPoints: 0,
      exactCount: 0,
      total: 0,
    };
  }
  for (const p of preds ?? []) {
    if (!rows[p.user_id]) continue;
    rows[p.user_id].matchPoints += p.points_awarded ?? 0;
    if ((p.points_awarded ?? 0) === SCORING.EXACT_SCORE) rows[p.user_id].exactCount++;
  }
  for (const g of gsp ?? []) {
    if (rows[g.user_id]) rows[g.user_id].groupPoints += g.points_awarded ?? 0;
  }
  for (const b of bracket ?? []) {
    if (rows[b.user_id]) rows[b.user_id].bracketPoints += b.points_awarded ?? 0;
  }
  for (const pen of penalties ?? []) {
    if (rows[pen.user_id]) rows[pen.user_id].penaltyPoints += pen.points ?? 0;
  }
  for (const r of Object.values(rows))
    r.total = r.matchPoints + r.groupPoints + r.bracketPoints + r.penaltyPoints;

  return Object.values(rows).sort(
    (a, b) =>
      b.total - a.total ||
      b.exactCount - a.exactCount ||
      a.display_name.localeCompare(b.display_name)
  );
}

/**
 * "slug" de un jugador para casar con el nombre de archivo de su imagen de
 * ganador. Regla: minúsculas, sin acentos, y todo lo que no sea a-z0-9 pasa a
 * guion (sin guiones al principio/final). Ej.: "Julio" → "julio";
 * "José María" → "jose-maria".
 */
export function playerSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
