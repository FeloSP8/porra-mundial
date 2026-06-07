import { isoFor } from "@/lib/flags";

/**
 * Bandera de un equipo como imagen SVG (librería flag-icons).
 * Se ve igual en Windows, Mac y móvil. Si el equipo no está en el mapa,
 * no pinta nada (no rompe la UI).
 *
 * Requiere que "flag-icons/css/flag-icons.min.css" esté importado en
 * app/layout.tsx.
 */
export default function Flag({
  team,
  className = "",
}: {
  team: string;
  className?: string;
}) {
  const code = isoFor(team);
  if (!code) return null;
  return (
    <span
      className={`fi fi-${code} rounded-sm ${className}`}
      style={{ width: "1.33em", height: "1em" }}
      role="img"
      aria-label={team}
    />
  );
}
